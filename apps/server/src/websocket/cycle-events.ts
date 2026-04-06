import { broadcast } from "./handler";

/**
 * Broadcast that a cycle was created, updated, activated, completed, or deleted.
 */
export function broadcastCycleUpdated(
  projectId: string,
  data: unknown,
): void {
  broadcast(`project:${projectId}`, {
    type: "cycle.updated",
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that an issue was added to or removed from a cycle.
 */
export function broadcastCycleIssueChanged(
  projectId: string,
  data: unknown,
): void {
  broadcast(`project:${projectId}`, {
    type: "cycle.issue_changed",
    payload: data,
    timestamp: new Date().toISOString(),
  });
}
