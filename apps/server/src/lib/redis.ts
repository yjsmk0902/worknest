import Redis from "ioredis";

/**
 * Create a Redis connection from the REDIS_URL environment variable.
 * Falls back to localhost:6379 for local development.
 */
export function createRedis(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
    lazyConnect: false,
  });
}
