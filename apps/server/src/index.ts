import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(import.meta.dirname, '../../../.env') });

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import pino from 'pino';

import { createDb } from '@worknest/db';
import { runMigrations } from '@worknest/db/migrate';
import { registerAllJobs } from './jobs/index';
import { createAuth } from './lib/auth';
import { errorHandler } from './lib/errors';
import { addJob, closeQueue, initQueue, startWorker } from './lib/queue';
import { createRedis } from './lib/redis';
import { globalRateLimit } from './middleware/rate-limit';
import { registerSecurityHeaders } from './middleware/security-headers';

import { authRoutes } from './routes/auth';
import { commentRoutes } from './routes/comments';
import { cycleRoutes } from './routes/cycles';
import { favoriteRoutes } from './routes/favorites';
import { fileRoutes } from './routes/files';
// Routes
import { healthRoutes } from './routes/health';
import { issueStatusRoutes } from './routes/issue-statuses';
import { issueTemplateRoutes } from './routes/issue-templates';
import { issueTypeRoutes } from './routes/issue-types';
import { issueRoutes } from './routes/issues';
import { joinRequestRoutes } from './routes/join-requests';
import { labelRoutes } from './routes/labels';
import { myWorkRoutes } from './routes/my-work';
import { notificationRoutes } from './routes/notifications';
import { organizationRoutes } from './routes/organizations';
import { profileRoutes } from './routes/profile';
import { projectRoutes } from './routes/projects';
import { searchRoutes } from './routes/search';
import { urlPreviewRoutes } from './routes/url-preview';
import { viewRoutes } from './routes/views';
import { wikiPageRoutes } from './routes/wiki-pages';
import { wikiRevisionRoutes } from './routes/wiki-revisions';
import { wikiShareRoutes } from './routes/wiki-shares';
import { wikiSpaceRoutes } from './routes/wiki-spaces';
import { workspaceRoutes } from './routes/workspaces';

// WebSocket
import { websocketHandler } from './websocket/handler';

// ── Bootstrap ──────────────────────────────────────────────────────────

const isWorkerOnly = process.env.WORKER_ONLY === 'true';

async function main() {
  const logLevel = process.env.LOG_LEVEL ?? 'info';

  // ── Worker-only mode ─────────────────────────────────────────────
  // Starts DB + Redis + BullMQ worker without the HTTP server.
  // Useful in production to run workers as separate processes.

  if (isWorkerOnly) {
    const logger = pino({
      level: logLevel,
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    });

    logger.info('Starting in worker-only mode...');

    // ── Infrastructure ───────────────────────────────────────────

    const { db, client: pgClient } = createDb();

    try {
      await runMigrations(db);
    } catch (err) {
      logger.error(err, 'Database migration failed — aborting startup.');
      process.exit(1);
    }

    const redis = createRedis();

    // ── BullMQ ───────────────────────────────────────────────────

    initQueue();
    registerAllJobs(db);
    startWorker();

    // Schedule orphan file cleanup (runs every hour)
    await addJob('orphan-cleanup', {}, { repeat: { every: 60 * 60 * 1000 } });

    // Schedule hard-delete cleanup (runs every 24 hours)
    await addJob('hard-delete-cleanup', {}, { repeat: { every: 24 * 60 * 60 * 1000 } });

    // ── Graceful Shutdown ────────────────────────────────────────

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down worker gracefully...`);
      await closeQueue();
      await redis.quit();
      await pgClient.end();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // NOTE: In worker-only mode, real-time WebSocket notifications (sendToUser)
    // are not delivered because there is no HTTP/WebSocket server running.
    // v1.0: Use Redis Pub/Sub to forward notifications to the API server.
    logger.info('Worker started (worker-only mode)');
    return;
  }

  // ── Full server mode (default) ───────────────────────────────────

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  // ── Fastify Instance ─────────────────────────────────────────────

  const app = Fastify({
    logger: {
      level: logLevel,
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ── Error Handler ────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  // ── Plugins ──────────────────────────────────────────────────────

  // Parse comma-separated CORS origins; default to localhost in development
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25MB
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Worknest API',
          description: 'Worknest — project management and knowledge platform',
          version: '0.1.0',
        },
        servers: [{ url: `http://localhost:${port}` }],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/api/v1/docs',
    });
  }

  await app.register(websocket);

  // ── Security Headers ──────────────────────────────────────────────

  registerSecurityHeaders(app);

  // ── Global Rate Limit ────────────────────────────────────────────

  app.addHook('preHandler', globalRateLimit);

  // ── Infrastructure ───────────────────────────────────────────────

  const { db, client: pgClient } = createDb();

  // Run database migrations before anything else touches the DB
  try {
    await runMigrations(db);
  } catch (err) {
    console.error('Database migration failed — aborting startup.', err);
    process.exit(1);
  }

  const redis = createRedis();
  const auth = createAuth(db);

  // Initialize BullMQ
  initQueue();
  registerAllJobs(db);
  startWorker();

  // Schedule orphan file cleanup (runs every hour)
  await addJob('orphan-cleanup', {}, { repeat: { every: 60 * 60 * 1000 } });

  // Schedule hard-delete cleanup (runs every 24 hours)
  await addJob('hard-delete-cleanup', {}, { repeat: { every: 24 * 60 * 60 * 1000 } });

  // ── Register Routes ──────────────────────────────────────────────

  await healthRoutes(app, { db, redis });
  await authRoutes(app, { auth, db });
  await profileRoutes(app, { auth, db });
  await organizationRoutes(app, { auth, db });
  await joinRequestRoutes(app, { auth, db });
  await workspaceRoutes(app, { auth, db });
  await projectRoutes(app, { auth, db });
  await issueStatusRoutes(app, { auth, db });
  await issueTypeRoutes(app, { auth, db });
  await issueTemplateRoutes(app, { auth, db });
  await labelRoutes(app, { auth, db });
  await issueRoutes(app, { auth, db });
  await viewRoutes(app, { auth, db });
  await cycleRoutes(app, { auth, db });
  await wikiSpaceRoutes(app, { auth, db });
  await wikiPageRoutes(app, { auth, db });
  await wikiShareRoutes(app, { auth, db });
  await wikiRevisionRoutes(app, { auth, db });
  await fileRoutes(app, { auth, db });
  await searchRoutes(app, { auth, db });
  await commentRoutes(app, { auth, db });
  await notificationRoutes(app, { auth, db });
  await myWorkRoutes(app, { auth, db });
  await favoriteRoutes(app, { auth, db });
  await urlPreviewRoutes(app, { auth, db });
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

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ── Start ────────────────────────────────────────────────────────

  await app.listen({ port, host });
  app.log.info(`Worknest server listening on http://${host}:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    app.log.info(`API docs available at http://${host}:${port}/api/v1/docs`);
  }
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
