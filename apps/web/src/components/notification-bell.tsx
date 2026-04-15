import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { NotificationOutput, NotificationType } from '@worknest/shared';
import { Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@worknest/ui';
import { AtSign, Bell, Mail, MessageSquare, RefreshCw, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotificationRealtime } from '../hooks/use-notification-realtime';
import { type ListResponse, apiClient } from '../lib/api-client';
import { formatRelativeTime } from '../lib/format-time';

// ── Notification type icon config ────────────────────────────────────────

const NOTIFICATION_ICON_MAP: Record<
  NotificationType,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  assigned: { icon: UserPlus, color: 'text-blue-500' },
  mentioned: { icon: AtSign, color: 'text-purple-500' },
  commented: { icon: MessageSquare, color: 'text-green-500' },
  status_changed: { icon: RefreshCw, color: 'text-orange-500' },
  invited: { icon: Mail, color: 'text-primary' },
};

// ── Component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const animateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  // Shake animation trigger callback
  const handleNewNotification = useCallback(() => {
    setAnimate(true);
    if (animateTimeoutRef.current) {
      clearTimeout(animateTimeoutRef.current);
    }
    animateTimeoutRef.current = setTimeout(() => {
      setAnimate(false);
      animateTimeoutRef.current = null;
    }, 600);
  }, []);

  // Cleanup animation timeout on unmount
  useEffect(() => {
    return () => {
      if (animateTimeoutRef.current) {
        clearTimeout(animateTimeoutRef.current);
      }
    };
  }, []);

  // WebSocket realtime subscription
  useNotificationRealtime(handleNewNotification);

  // Fetch unread count
  const unreadQuery = useQuery<{ count: number }>({
    queryKey: ['my', 'notifications', 'unread-count'],
    queryFn: () => apiClient.get<{ count: number }>('/my/notifications/unread-count'),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Fetch recent notifications (for popover dropdown)
  const notificationsQuery = useQuery<ListResponse<NotificationOutput>>({
    queryKey: ['my', 'notifications', 'bell-dropdown'],
    queryFn: () =>
      apiClient.getList<NotificationOutput>('/my/notifications', {
        limit: '10',
      }),
    staleTime: 30 * 1000,
    enabled: open, // Only fetch when popover is open
  });

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(`/notifications/${notificationId}`, { read: true }),
    onMutate: async (notificationId: string) => {
      // Optimistic update: remove unread dot and decrement count
      await queryClient.cancelQueries({
        queryKey: ['my', 'notifications', 'bell-dropdown'],
      });

      queryClient.setQueryData(
        ['my', 'notifications', 'bell-dropdown'],
        (old: ListResponse<NotificationOutput> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((n: NotificationOutput) =>
              n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
            ),
          };
        },
      );

      queryClient.setQueryData(
        ['my', 'notifications', 'unread-count'],
        (old: { count: number } | undefined) => (old ? { count: Math.max(0, old.count - 1) } : old),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['my', 'notifications', 'unread-count'],
      });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.patch('/my/notifications/read-all'),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ['my', 'notifications', 'bell-dropdown'],
      });

      queryClient.setQueryData(
        ['my', 'notifications', 'bell-dropdown'],
        (old: ListResponse<NotificationOutput> | undefined) => {
          if (!old) return old;
          const now = new Date().toISOString();
          return {
            ...old,
            data: old.data.map((n: NotificationOutput) => ({
              ...n,
              readAt: n.readAt ?? now,
            })),
          };
        },
      );

      queryClient.setQueryData(['my', 'notifications', 'unread-count'], { count: 0 });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['my', 'notifications', 'unread-count'],
      });
    },
  });

  // Handle notification item click
  const handleNotificationClick = useCallback(
    (notification: NotificationOutput) => {
      // Mark as read if unread
      if (!notification.readAt) {
        markReadMutation.mutate(notification.id);
      }

      // Close popover
      setOpen(false);

      // Navigate to inbox (entity-specific navigation can be added later)
      if (orgSlug && wsSlug) {
        navigate({
          to: '/$orgSlug/$wsSlug/my/inbox',
          params: { orgSlug, wsSlug },
        });
      }
    },
    [markReadMutation, navigate, orgSlug, wsSlug],
  );

  // Navigate to full inbox
  const handleViewAll = useCallback(() => {
    setOpen(false);
    if (orgSlug && wsSlug) {
      navigate({
        to: '/$orgSlug/$wsSlug/my/inbox',
        params: { orgSlug, wsSlug },
      });
    }
  }, [navigate, orgSlug, wsSlug]);

  const unreadCount = unreadQuery.data?.count ?? 0;
  const notifications = notificationsQuery.data?.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="알림"
          aria-haspopup="true"
          aria-expanded={open}
          data-animate={animate || undefined}
        >
          <Bell className={`h-5 w-5 ${animate ? 'animate-bell-shake' : ''}`} />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white"
              aria-label={`읽지 않은 알림 ${unreadCount}개`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" className="w-[360px] max-h-[400px] rounded-xl p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">알림</span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            aria-label="모든 알림 읽음 처리"
          >
            모두 읽음
          </button>
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Bell className="h-7 w-7 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">새로운 알림이 없습니다</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div role="list" aria-label="최근 알림">
              {notifications.map((notification, index) => {
                const iconConfig = NOTIFICATION_ICON_MAP[notification.type];
                const IconComponent = iconConfig.icon;
                const isUnread = !notification.readAt;
                const isLast = index === notifications.length - 1;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    aria-label={notification.message}
                    className={`flex h-12 w-full cursor-pointer items-center gap-2.5 px-4 hover:bg-accent/50 ${
                      isLast ? '' : 'border-b border-border/30'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Type icon */}
                    <IconComponent className={`h-4 w-4 shrink-0 ${iconConfig.color}`} />

                    {/* Message */}
                    <span className="min-w-0 flex-1 truncate text-left text-xs text-foreground">
                      {notification.message}
                    </span>

                    {/* Timestamp */}
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </span>

                    {/* Unread dot */}
                    {isUnread && <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center border-t border-border py-2.5">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleViewAll}
          >
            모든 알림 보기
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
