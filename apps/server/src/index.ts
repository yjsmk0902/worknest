import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";

import { createDb } from "@worknest/db";
import { runMigrations } from "@worknest/db/migrate";
import { createAuth } from "./lib/auth";
import { createRedis } from "./lib/redis";
import { errorHandler } from "./lib/errors";
import { globalRateLimit } from "./middleware/rate-limit";
import { initQueue, startWorker, closeQueue, addJob } from "./lib/queue";
import { registerAllJobs } from "./jobs/index";

// Routes
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { profileRoutes } from "./routes/profile";
import { organizationRoutes } from "./routes/organizations";
import { workspaceRoutes } from "./routes/workspaces";
import { projectRoutes } from "./routes/projects";
import { issueStatusRoutes } from "./routes/issue-statuses";
import { issueTypeRoutes } from "./routes/issue-types";
import { labelRoutes } from "./routes/labels";
import { issueRoutes } from "./routes/issues";
import { viewRoutes } from "./routes/views";
import { cycleRoutes } from "./routes/cycles";
import { wikiSpaceRoutes } from "./routes/wiki-spaces";
import { wikiPageRoutes } from "./routes/wiki-pages";
import { fileRoutes } from "./routes/files";

// WebSocket
import { websocketHandler } from "./websocket/handler";

// ── Bootstrap ──────────────────────────────────────────────────────────

async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  const logLevel = process.env.LOG_LEVEL ?? "info";

  // ── Fastify Instance ─────────────────────────────────────────────

  const app = Fastify({
    logger: {
      level: logLevel,
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Error Handler ────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  // ── Plugins ──────────────────────────────────────────────────────

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
    credentials: true,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Worknest API",
        description: "Worknest — project management and knowledge platform",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${port}` }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/api/v1/docs",
  });

  await app.register(websocket);

  // ── Global Rate Limit ────────────────────────────────────────────

  app.addHook("preHandler", globalRateLimit);

  // ── Infrastructure ───────────────────────────────────────────────

  const { db, client: pgClient } = createDb();

  // Run database migrations before anything else touches the DB
  try {
    await runMigrations(db);
  } catch (err) {
    console.error("Database migration failed — aborting startup.", err);
    process.exit(1);
  }

  const redis = createRedis();
  const auth = createAuth(db);

  // Initialize BullMQ
  initQueue();
  registerAllJobs(db);
  startWorker();

  // Schedule orphan file cleanup (runs every hour)
  await addJob("orphan-cleanup", {}, { repeat: { every: 60 * 60 * 1000 } });

  // ── Register Routes ──────────────────────────────────────────────

  await healthRoutes(app, { db, redis });
  await authRoutes(app, { auth, db });
  await profileRoutes(app, { auth, db });
  await organizationRoutes(app, { auth, db });
  await workspaceRoutes(app, { auth, db });
  await projectRoutes(app, { auth, db });
  await issueStatusRoutes(app, { auth, db });
  await issueTypeRoutes(app, { auth, db });
  await labelRoutes(app, { auth, db });
  await issueRoutes(app, { auth, db });
  await viewRoutes(app, { auth, db });
  await cycleRoutes(app, { auth, db });
  await wikiSpaceRoutes(app, { auth, db });
  await wikiPageRoutes(app, { auth, db });
  await fileRoutes(app, { auth, db });
  await websocketHandler(app, { auth, db });

  // ── Graceful Shutdown ────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    await closeQueue();
    await redis.quit();
    await pgClient.end();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // ── Start ────────────────────────────────────────────────────────

  await app.listen({ port, host });
  app.log.info(`Worknest server listening on http://${host}:${port}`);
  app.log.info(`API docs available at http://${host}:${port}/api/v1/docs`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
