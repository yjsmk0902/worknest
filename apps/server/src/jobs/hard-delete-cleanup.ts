import * as fs from 'node:fs';
import { type Database, comments, files, issues, wikiPages } from '@worknest/db';
import type { Job } from 'bullmq';
import { and, inArray, isNotNull, lt } from 'drizzle-orm';

// ── Types ────────────────────────────────────────────────────────────────

type HardDeleteCleanupJobData = Record<string, never>;

// ── Constants ────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;
const RETENTION_DAYS = 30;

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Delete a file from disk. Non-fatal: logs errors and continues.
 */
function safeUnlink(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Failed to delete file from disk: ${filePath}`, err);
  }
}

/**
 * Collect file paths for a batch of issue IDs and delete them from disk.
 */
async function deleteIssueFiles(db: Database, issueIds: string[]): Promise<void> {
  const attachedFiles = await db
    .select({ path: files.path })
    .from(files)
    .where(inArray(files.issueId, issueIds));

  for (const file of attachedFiles) {
    safeUnlink(file.path);
    // Also try to delete thumbnail
    const thumbnailPath = file.path.replace(/(\.[^.]+)$/, '.thumb.webp');
    safeUnlink(thumbnailPath);
  }
}

/**
 * Collect file paths for a batch of wiki page IDs and delete them from disk.
 */
async function deletePageFiles(db: Database, pageIds: string[]): Promise<void> {
  const attachedFiles = await db
    .select({ path: files.path })
    .from(files)
    .where(inArray(files.pageId, pageIds));

  for (const file of attachedFiles) {
    safeUnlink(file.path);
    const thumbnailPath = file.path.replace(/(\.[^.]+)$/, '.thumb.webp');
    safeUnlink(thumbnailPath);
  }
}

// ── Processor ────────────────────────────────────────────────────────────

/**
 * Create a hard-delete cleanup job processor bound to a database instance.
 *
 * Finds soft-deleted entities where deleted_at is older than 30 days and
 * permanently removes them. Processes in batches of 100 to avoid long
 * transactions.
 *
 * Order:
 *   1. Issues — collect file paths, delete from disk, hard delete (CASCADE
 *      handles files, assignees, labels, comments, reactions, activities)
 *   2. Wiki pages — collect file paths, delete from disk, hard delete
 *   3. Comments — hard delete orphaned soft-deleted comments (CASCADE
 *      handles reactions)
 */
export function createHardDeleteCleanupProcessor(db: Database) {
  return async (_job: Job<HardDeleteCleanupJobData>): Promise<void> => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let totalIssues = 0;
    let totalPages = 0;
    let totalComments = 0;

    // ── 1. Hard delete issues ──────────────────────────────────────

    let hasMore = true;
    while (hasMore) {
      const batch = await db
        .select({ id: issues.id })
        .from(issues)
        .where(and(isNotNull(issues.deletedAt), lt(issues.deletedAt, cutoff)))
        .limit(BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const batchIds = batch.map((row) => row.id);

      // Delete associated files from disk before hard deleting
      await deleteIssueFiles(db, batchIds);

      // Hard delete — CASCADE handles files, assignees, labels,
      // comments, reactions, activities
      await db.delete(issues).where(inArray(issues.id, batchIds));

      totalIssues += batch.length;

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // ── 2. Hard delete wiki pages ──────────────────────────────────

    hasMore = true;
    while (hasMore) {
      const batch = await db
        .select({ id: wikiPages.id })
        .from(wikiPages)
        .where(and(isNotNull(wikiPages.deletedAt), lt(wikiPages.deletedAt, cutoff)))
        .limit(BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const batchIds = batch.map((row) => row.id);

      // Delete associated files from disk before hard deleting
      await deletePageFiles(db, batchIds);

      // Hard delete — CASCADE handles files, comments, reactions
      await db.delete(wikiPages).where(inArray(wikiPages.id, batchIds));

      totalPages += batch.length;

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // ── 3. Hard delete comments ────────────────────────────────────

    hasMore = true;
    while (hasMore) {
      const batch = await db
        .select({ id: comments.id })
        .from(comments)
        .where(and(isNotNull(comments.deletedAt), lt(comments.deletedAt, cutoff)))
        .limit(BATCH_SIZE);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const batchIds = batch.map((row) => row.id);

      // Hard delete — CASCADE handles reactions
      await db.delete(comments).where(inArray(comments.id, batchIds));

      totalComments += batch.length;

      if (batch.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    // ── Log summary ────────────────────────────────────────────────
    // TODO(CP-7): console.log is used here because BullMQ job processors
    // don't have access to the Fastify logger. Consider injecting a pino
    // logger instance when refactoring the job system.

    if (totalIssues > 0 || totalPages > 0 || totalComments > 0) {
      console.log(
        `Hard-delete cleanup: ${totalIssues} issue(s), ${totalPages} wiki page(s), ${totalComments} comment(s) permanently deleted`,
      );
    }
  };
}
