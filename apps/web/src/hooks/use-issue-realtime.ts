import { useMemo } from 'react';
import { queryClient } from '../lib/query-client';
import { useWebSocket } from './use-websocket';
import { useWebSocketEvent } from './use-websocket-event';

/**
 * Subscribe to real-time issue events for a project.
 * Automatically invalidates or updates TanStack Query cache on changes.
 */
export function useIssueRealtime(projectId: string): void {
  const channels = useMemo(() => [`project:${projectId}`], [projectId]);
  useWebSocket(channels);

  // issue.created -> invalidate issues list
  useWebSocketEvent('issue.created', () => {
    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'issues'],
    });
  });

  // issue.updated -> invalidate issues list and the specific issue
  useWebSocketEvent('issue.updated', (data) => {
    const issue = data as { id?: string } | undefined;

    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'issues'],
    });

    if (issue?.id) {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issue.id],
      });
    }
  });

  // issue.deleted -> invalidate issues list and remove specific issue
  useWebSocketEvent('issue.deleted', (data) => {
    const payload = data as { id?: string } | undefined;

    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'issues'],
    });

    if (payload?.id) {
      queryClient.removeQueries({
        queryKey: ['projects', projectId, 'issues', payload.id],
      });
    }
  });
}
