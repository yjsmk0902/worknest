import type { Job } from "bullmq";
import { and, isNull, lt, inArray } from "drizzle-orm";
import { files, type Database } from "@worknest/db";
import * as fs from "node:fs";

// ── Types ────────────────────────────────────────────────────────────────

interface OrphanCleanupJobData {
  // No data needed — runs on schedule
}

// ── Processor ────────────────────────────────────────────────────────────

/**
 * Create an orphan file cleanup job processor bound to a database instance.
 *
 * Finds files where:
 * - issue_id IS NULL
 * - page_id IS NULL
 * - created_at < 24 hours ago
 *
 * These are temporary uploads that were never attached to an issue or page.
 * Deletes both the database records and the files from disk.
 */
export function createOrphanCleanupProcessor(db: Database) {
  return async (_job: Job<OrphanCleanupJobData>): Promise<void> => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find orphan files
    const orphans = await db
      .select()
      .from(files)
      .where(
        and(
          isNull(files.issueId),
          isNull(files.pageId),
          lt(files.createdAt, cutoff),
        ),
      );

    if (orphans.length === 0) return;

    // Delete files from disk
    for (const orphan of orphans) {
      try {
        if (fs.existsSync(orphan.path)) {
          fs.unlinkSync(orphan.path);
        }
        // Also try to delete thumbnail
        const thumbnailPath = orphan.path.replace(
          /(\.[^.]+)$/,
          ".thumb.webp",
        );
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      } catch {
        // Non-fatal: continue cleaning up other files
      }
    }

    // Delete from DB by IDs
    const orphanIds = orphans.map((f) => f.id);
    await db.delete(files).where(inArray(files.id, orphanIds));

    console.log(`Cleaned up ${orphans.length} orphan file(s)`);
  };
}
