import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

// Re-export everything from schema for convenience
export * from "./schema/index";

/**
 * Create a Postgres connection and Drizzle client.
 *
 * Uses `DATABASE_URL` from the environment. The caller (typically the server
 * app) is responsible for ensuring the variable is set before importing.
 */
export function createDb(url?: string) {
  const connectionString = url ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Provide it via environment variable or pass it explicitly.",
    );
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>["db"];
