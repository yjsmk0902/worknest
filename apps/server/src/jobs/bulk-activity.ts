import type { Job } from "bullmq";
import { activities, type Database } from "@worknest/db";

// ── Types ────────────────────────────────────────────────────────────────

interface BulkActivityJobData {
  actorId: string;
  projectId: string;
  issueIds: string[];
  changes: {
    statusId?: string;
    typeId?: string;
    priority?: string;
    assigneeIds?: string[];
    labelIds?: string[];
  };
}

// ── Processor ────────────────────────────────────────────────────────────

/**
 * Create a bulk-activity job processor bound to a database instance.
 *
 * For each issue in the batch, creates Activity records for every
 * changed field. This runs asynchronously after the bulk update
 * transaction has already committed.
 */
export function createBulkActivityProcessor(db: Database) {
  return async (job: Job<BulkActivityJobData>): Promise<void> => {
    const { actorId, projectId, issueIds, changes } = job.data;

    // Determine which fields changed
    const changedFields: { field: string; newValue: string }[] = [];
    if (changes.statusId) {
      changedFields.push({ field: "status", newValue: changes.statusId });
    }
    if (changes.typeId) {
      changedFields.push({ field: "type", newValue: changes.typeId });
    }
    if (changes.priority) {
      changedFields.push({ field: "priority", newValue: changes.priority });
    }
    if (changes.assigneeIds !== undefined) {
      changedFields.push({
        field: "assignees",
        newValue: JSON.stringify(changes.assigneeIds),
      });
    }
    if (changes.labelIds !== undefined) {
      changedFields.push({
        field: "labels",
        newValue: JSON.stringify(changes.labelIds),
      });
    }

    if (changedFields.length === 0) return;

    // Create activity records for each issue x each changed field
    const activityRows = issueIds.flatMap((issueId) =>
      changedFields.map((change) => ({
        actorId,
        issueId,
        projectId,
        action: "bulk_updated" as const,
        field: change.field,
        oldValue: null,
        newValue: change.newValue,
        metadata: null,
      })),
    );

    // Insert in a single batch
    if (activityRows.length > 0) {
      await db.insert(activities).values(activityRows);
    }
  };
}
