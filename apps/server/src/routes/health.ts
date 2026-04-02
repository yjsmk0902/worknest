import type { FastifyInstance } from "fastify";
import type { Database } from "@worknest/db";
import type Redis from "ioredis";
import { sql } from "drizzle-orm";

/**
 * Health-check routes.
 *
 * - GET /healthz — liveness probe (always 200)
 * - GET /readyz  — readiness probe (checks DB + Redis connectivity)
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
        summary: "Readiness probe — checks DB and Redis",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              services: {
                type: "object",
                properties: {
                  database: { type: "string" },
                  redis: { type: "string" },
                },
              },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              services: {
                type: "object",
                properties: {
                  database: { type: "string" },
                  redis: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const services: Record<string, string> = {
        database: "unknown",
        redis: "unknown",
      };
      let healthy = true;

      // Check Postgres
      try {
        await db.execute(sql`SELECT 1`);
        services.database = "ok";
      } catch {
        services.database = "error";
        healthy = false;
      }

      // Check Redis
      try {
        const pong = await redis.ping();
        services.redis = pong === "PONG" ? "ok" : "error";
      } catch {
        services.redis = "error";
        healthy = false;
      }

      const statusCode = healthy ? 200 : 503;
      return reply.status(statusCode).send({
        status: healthy ? "ok" : "degraded",
        services,
      });
    },
  );
}
