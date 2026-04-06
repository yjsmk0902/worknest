import { useCallback, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@worknest/ui';
import type { NotificationOutput, NotificationType } from '@worknest/shared';
import { useWebSocketEvent } from './use-websocket-event';

/**
 * Icon labels for toast messages per notification type.
 */
const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  assigned: '할당',
  mentioned: '멘션',
  commented: '댓글',
  status_changed: '상태 변경',
  invited: '초대',
};

/**
 * Listen for `notification.new` WebSocket events and:
 * 1. Invalidate notification queries (list + unread count)
 * 2. Show a Sonner toast with "보기" action
 * 3. Call `onNew` callback (used by the bell for shake animation)
 */
export function useNotificationRealtime(onNew?: () => void): void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  // Track shown toast IDs to prevent duplicates
  const shownToastIds = useRef(new Set<string>());

  const handler = useCallback(
    (data: unknown) => {
      const notification = data as NotificationOutput;

      // Invalidate queries so bell badge + inbox update
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['my', 'notifications', 'unread-count'],
      });

      // Fire onNew callback (for bell shake animation)
      onNew?.();

      // Prevent duplicate toasts for the same notification
      if (shownToastIds.current.has(notification.id)) return;
      shownToastIds.current.add(notification.id);

      // Clean up old IDs to prevent memory growth (keep last 50)
      if (shownToastIds.current.size > 50) {
        const entries = Array.from(shownToastIds.current);
        for (let i = 0; i < entries.length - 50; i++) {
          shownToastIds.current.delete(entries[i]);
        }
      }

      // Show Sonner toast
      const label = NOTIFICATION_TYPE_LABEL[notification.type] ?? '알림';

      toast(notification.message, {
        description: label,
        duration: 5000,
        action: orgSlug && wsSlug
          ? {
              label: '보기',
              onClick: () => {
                navigate({
                  to: '/$orgSlug/$wsSlug/my/inbox',
                  params: { orgSlug, wsSlug },
                });
              },
            }
          : undefined,
      });
    },
    [queryClient, onNew, navigate, orgSlug, wsSlug],
  );

  useWebSocketEvent('notification.new', handler);
}
