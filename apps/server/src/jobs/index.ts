import type { Database } from "@worknest/db";
import { registerProcessor } from "../lib/queue";
import { createBulkActivityProcessor } from "./bulk-activity";

/**
 * Job processor registry.
 *
 * Register all BullMQ job processors. Must be called before `startWorker()`.
 */
export function registerAllJobs(db: Database): void {
  registerProcessor({
    name: "bulk-activity",
    processor: createBulkActivityProcessor(db),
  });
}
