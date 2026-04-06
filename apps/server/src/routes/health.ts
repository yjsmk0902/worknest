import type { FastifyInstance } from "fastify";
import type { Database } from "@worknest/db";
import type Redis from "ioredis";
import { sql } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

const APP_VERSION = process.env.APP_VERSION ?? "0.0.0";
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "uploads";

/**
 * Health-check routes.
 *
 * - GET /healthz — liveness probe (always 200)
 * - GET /readyz  — readiness probe (checks DB, Redis, disk + reports latency)
 */
export async function healthRoutes(
  app: FastifyInstance,
  opts: { db: Database; redis: Redis },
): Promise<void> {
  const { db, redis } = opts;

  app.get(
    "/healthz",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness probe",
        response: {
          200: {
            type: "object",
            properties: { status: { type: "string" } },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({ status: "ok" });
    },
  );

  app.get(
    "/readyz",
    {
      schema: {
        tags: ["Health"],
        summary:
          "Readiness probe — checks DB, Redis, and disk with latency info",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              uptime: { type: "number" },
              services: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    latency_ms: { type: "number" },
                  },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              uptime: { type: "number" },
              services: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    latency_ms: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const services: Record<
        string,
        { status: string; latency_ms?: number }
      > = {};
      let healthy = true;

      // Check Postgres
      {
        const start = performance.now();
        try {
          await db.execute(sql`SELECT 1`);
          services.database = {
            status: "ok",
            latency_ms: Math.round(performance.now() - start),
          };
        } catch {
          services.database = {
            status: "error",
            latency_ms: Math.round(performance.now() - start),
          };
          healthy = false;
        }
      }

      // Check Redis
      {
        const start = performance.now();
        try {
          const pong = await redis.ping();
          services.redis = {
            status: pong === "PONG" ? "ok" : "error",
            latency_ms: Math.round(performance.now() - start),
          };
          if (pong !== "PONG") healthy = false;
        } catch {
          services.redis = {
            status: "error",
            latency_ms: Math.round(performance.now() - start),
          };
          healthy = false;
        }
      }

      // Check disk — verify uploads directory is writable
      {
        const start = performance.now();
        const tempFile = path.join(
          UPLOADS_DIR,
          `.healthcheck-${Date.now()}.tmp`,
        );
        try {
          fs.writeFileSync(tempFile, "ok");
          fs.unlinkSync(tempFile);
          services.disk = {
            status: "ok",
            latency_ms: Math.round(performance.now() - start),
          };
        } catch {
          services.disk = {
            status: "error",
            latency_ms: Math.round(performance.now() - start),
          };
          healthy = false;
        }
      }

      const statusCode = healthy ? 200 : 503;
      return reply.status(statusCode).send({
        status: healthy ? "ok" : "degraded",
        version: APP_VERSION,
        uptime: Math.round(process.uptime()),
        services,
      });
    },
  );
}
