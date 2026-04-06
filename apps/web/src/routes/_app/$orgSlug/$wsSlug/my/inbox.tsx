import { useState, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  UserPlus,
  AtSign,
  MessageSquare,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { Button, Skeleton, toast } from '@worknest/ui';
import type { NotificationOutput, NotificationType } from '@worknest/shared';
import { apiClient, type ListResponse } from '../../../../../lib/api-client';
import { useWorkspaceContext } from '../../../../../contexts/workspace-context';
import { formatRelativeTime } from '../../../../../lib/format-time';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/my/inbox',
)({
  component: InboxPage,
});

// ── Notification type icon config ──────────────────────────────────────

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

// ── Filter type ────────────────────────────────────────────────────────

type FilterMode = 'all' | 'unread';

// ── Main Component ─────────────────────────────────────────────────────

function InboxPage() {
  const { orgSlug, wsSlug } = Route.useParams();
  useWorkspaceContext(); // Ensure workspace context is available
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterMode>('all');

  // Fetch notifications
  const notificationsQuery = useInfiniteQuery<ListResponse<NotificationOutput>>(
    {
      queryKey: ['my', 'notifications'],
      queryFn: ({ pageParam }) => {
        const params: Record<string, string> = { limit: '30' };
        if (pageParam) {
          params.cursor = pageParam as string;
        }
        return apiClient.getList<NotificationOutput>(
          '/my/notifications',
          params,
        );
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) =>
        lastPage.pagination.has_more
          ? lastPage.pagination.next_cursor ?? undefined
          : undefined,
    },
  );

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(`/notifications/${notificationId}`, { read: true }),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['my', 'notifications'] });

      const previousData = queryClient.getQueryData(['my', 'notifications']);

      // Optimistic update
      queryClient.setQueryData(
        ['my', 'notifications'],
        (old: ReturnType<typeof notificationsQuery.data> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: ListResponse<NotificationOutput>) => ({
              ...page,
              data: page.data.map((n: NotificationOutput) =>
                n.id === notificationId
                  ? { ...n, readAt: new Date().toISOString() }
                  : n,
              ),
            })),
          };
        },
      );

      // Also update unread count
      queryClient.setQueryData(
        ['my', 'notifications', 'unread-count'],
        (old: { count: number } | undefined) =>
          old ? { count: Math.max(0, old.count - 1) } : old,
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ['my', 'notifications'],
          context.previousData,
        );
      }
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
      await queryClient.cancelQueries({ queryKey: ['my', 'notifications'] });

      const previousData = queryClient.getQueryData(['my', 'notifications']);

      queryClient.setQueryData(
        ['my', 'notifications'],
        (old: ReturnType<typeof notificationsQuery.data> | undefined) => {
          if (!old) return old;
          const now = new Date().toISOString();
          return {
            ...old,
            pages: old.pages.map((page: ListResponse<NotificationOutput>) => ({
              ...page,
              data: page.data.map((n: NotificationOutput) => ({
                ...n,
                readAt: n.readAt ?? now,
              })),
            })),
          };
        },
      );

      queryClient.setQueryData(
        ['my', 'notifications', 'unread-count'],
        { count: 0 },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ['my', 'notifications'],
          context.previousData,
        );
      }
      toast.error('읽음 처리에 실패했습니다.');
    },
    onSuccess: () => {
      toast('모든 알림이 읽음 처리되었습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications'] });
      queryClient.invalidateQueries({
        queryKey: ['my', 'notifications', 'unread-count'],
      });
    },
  });

  // Navigate to entity on click
  const handleNotificationClick = useCallback(
    (notification: NotificationOutput) => {
      // Mark as read if unread
      if (!notification.readAt) {
        markReadMutation.mutate(notification.id);
      }

      // Navigate to the entity
      if (notification.issueId) {
        // Navigate to issue — we don't have the project prefix info here,
        // so we navigate via a search-based approach or let the backend
        // provide a link. For now, the notification message contains the key.
        // We'll just navigate to the workspace and let the user find it.
        // In a real implementation, the notification would include routing info.
        navigate({
          to: '/$orgSlug/$wsSlug/my/inbox',
          params: { orgSlug, wsSlug },
        });
      } else if (notification.pageId) {
        navigate({
          to: '/$orgSlug/$wsSlug/my/inbox',
          params: { orgSlug, wsSlug },
        });
      }
    },
    [markReadMutation, navigate, orgSlug, wsSlug],
  );

  // Flatten pages
  const allNotifications =
    notificationsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  // Apply filter
  const filteredNotifications =
    filter === 'unread'
      ? allNotifications.filter((n) => !n.readAt)
      : allNotifications;

  // Loading state
  if (notificationsQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-semibold">알림</h1>
          <Skeleton className="h-8 w-28" />
        </div>
        {/* Filter toggle skeleton */}
        <div className="flex items-center gap-1 px-6 pb-2">
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        {/* Notification skeletons */}
        <div
          className="px-6"
          aria-busy="true"
          aria-label="알림 로딩 중"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="flex h-14 items-center gap-3 border-b border-border/50 px-4"
            >
              <Skeleton className="h-[18px] w-[18px] rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (notificationsQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-semibold">알림</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              알림을 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => notificationsQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-semibold">알림</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
          aria-label="모든 알림 읽음 처리"
        >
          <CheckCheck className="h-4 w-4" />
          모두 읽음 처리
        </Button>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-1 px-6 pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1.5 text-sm ${
            filter === 'all'
              ? 'bg-secondary font-medium text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`rounded-md px-3 py-1.5 text-sm ${
            filter === 'unread'
              ? 'bg-secondary font-medium text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          읽지 않음
        </button>
      </div>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
          <Bell className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">새로운 알림이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            알림이 도착하면 여기에 표시됩니다
          </p>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto px-6"
          role="list"
          aria-label="알림 목록"
        >
          {filteredNotifications.map((notification) => {
            const iconConfig = NOTIFICATION_ICON_MAP[notification.type];
            const IconComponent = iconConfig.icon;
            const isUnread = !notification.readAt;

            return (
              <button
                key={notification.id}
                type="button"
                role="listitem"
                aria-label={notification.message}
                className="flex h-14 w-full cursor-pointer items-center gap-3 border-b border-border/50 px-4 transition-colors duration-150 hover:bg-accent/50"
                onClick={() => handleNotificationClick(notification)}
              >
                {/* Type icon */}
                <IconComponent
                  className={`h-[18px] w-[18px] shrink-0 ${iconConfig.color}`}
                />

                {/* Message */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-left text-sm text-foreground">
                    {notification.message}
                  </p>
                </div>

                {/* Timestamp */}
                <span className="ml-2 shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </span>

                {/* Unread dot */}
                {isUnread && (
                  <span
                    className="ml-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                    aria-label="읽지 않음"
                  />
                )}
              </button>
            );
          })}

          {/* Load more */}
          {notificationsQuery.hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => notificationsQuery.fetchNextPage()}
                disabled={notificationsQuery.isFetchingNextPage}
              >
                {notificationsQuery.isFetchingNextPage
                  ? '불러오는 중...'
                  : '더 보기'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
