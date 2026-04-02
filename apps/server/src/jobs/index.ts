/**
 * Job processor registry.
 *
 * Import and register all BullMQ job processors here.
 * Each processor is registered by name so the worker can dispatch
 * incoming jobs to the correct handler.
 *
 * @example
 * ```ts
 * import { registerProcessor } from "../lib/queue";
 * import { processEmailJob } from "./email-job";
 *
 * export function registerAllJobs() {
 *   registerProcessor({ name: "send-email", processor: processEmailJob });
 * }
 * ```
 */
export function registerAllJobs(): void {
  // No jobs registered yet — add them as features are implemented.
  // Example:
  // registerProcessor({ name: "send-email", processor: processEmailJob });
}
