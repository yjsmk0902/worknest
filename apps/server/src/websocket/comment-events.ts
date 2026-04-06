import { broadcast } from "./handler";

/**
 * Broadcast that a new comment was created.
 * Channel is `issue:{issueId}` or `page:{pageId}`.
 */
export function broadcastCommentCreated(
  channel: string,
  data: unknown,
): void {
  broadcast(channel, {
    type: "comment.created",
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a comment was updated.
 */
export function broadcastCommentUpdated(
  channel: string,
  data: unknown,
): void {
  broadcast(channel, {
    type: "comment.updated",
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a comment was deleted.
 */
export function broadcastCommentDeleted(
  channel: string,
  data: unknown,
): void {
  broadcast(channel, {
    type: "comment.deleted",
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a reaction was toggled on a comment.
 */
export function broadcastReactionToggled(
  channel: string,
  data: unknown,
): void {
  broadcast(channel, {
    type: "reaction.toggled",
    payload: data,
    timestamp: new Date().toISOString(),
  });
}
