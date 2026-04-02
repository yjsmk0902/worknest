import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run all pending migrations.
 *
 * Call this from the server on startup to ensure the database schema is
 * up-to-date. Migrations are read from the `./migrations` directory
 * relative to this file.
 *
 * @example
 * ```ts
 * import { createDb } from "@worknest/db";
 * import { runMigrations } from "@worknest/db/migrate";
 *
 * const { db } = createDb();
 * await runMigrations(db);
 * ```
 */
export async function runMigrations(db: Database): Promise<void> {
  const migrationsFolder = path.join(__dirname, "migrations");

  console.log("[migrate] Running pending migrations...");

  try {
    await migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully.");
  } catch (error) {
    console.error("[migrate] Migration failed:", error);
    throw error;
  }
}
