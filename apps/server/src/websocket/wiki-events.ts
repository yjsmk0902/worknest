import { broadcast } from './handler';

/**
 * Broadcast that a new wiki page was created in a workspace.
 */
export function broadcastWikiPageCreated(workspaceId: string, data: unknown): void {
  broadcast(`workspace:${workspaceId}`, {
    type: 'wiki_page.created',
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a wiki page was updated in a workspace.
 */
export function broadcastWikiPageUpdated(workspaceId: string, data: unknown): void {
  broadcast(`workspace:${workspaceId}`, {
    type: 'wiki_page.updated',
    payload: data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a wiki page was deleted from a workspace.
 */
export function broadcastWikiPageDeleted(workspaceId: string, data: unknown): void {
  broadcast(`workspace:${workspaceId}`, {
    type: 'wiki_page.deleted',
    payload: data,
    timestamp: new Date().toISOString(),
  });
}
