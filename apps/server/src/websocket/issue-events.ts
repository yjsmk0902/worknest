import { broadcast } from "./handler";

/**
 * Broadcast that a new issue was created in a project.
 */
export function broadcastIssueCreated(
  projectId: string,
  issue: unknown,
): void {
  broadcast(`project:${projectId}`, {
    type: "issue.created",
    payload: issue,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that an issue was updated in a project.
 */
export function broadcastIssueUpdated(
  projectId: string,
  issue: unknown,
): void {
  broadcast(`project:${projectId}`, {
    type: "issue.updated",
    payload: issue,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that an issue was deleted from a project.
 */
export function broadcastIssueDeleted(
  projectId: string,
  issueId: string,
): void {
  broadcast(`project:${projectId}`, {
    type: "issue.deleted",
    payload: { id: issueId },
    timestamp: new Date().toISOString(),
  });
}
