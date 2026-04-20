import { EmptyState } from '@/components/empty-state';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { type ListResponse, apiClient } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/format-time';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { NotificationOutput, NotificationType } from '@worknest/shared';
import { Button, Chip, Kbd, Skeleton, toast } from '@worknest/ui';
import {
  AtSign,
  Bell,
  CheckCheck,
  Filter,
  Mail,
  MessageSquare,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/my/inbox')({
  component: InboxPage,
});

// ── Notification type icon config ──────────────────────────────────────

const NOTIFICATION_ICON_MAP: Record<
  NotificationType,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  assigned: { icon: UserPlus, label: '배정' },
  mentioned: { icon: AtSign, label: '멘션' },
  commented: { icon: MessageSquare, label: '댓글' },
  status_changed: { icon: RefreshCw, label: '상태 변경' },
  invited: { icon: Mail, label: '초대' },
  join_request_received: { icon: UserPlus, label: '가입 요청' },
  join_request_approved: { icon: CheckCheck, label: '가입 승인' },
  join_request_rejected: { icon: Bell, label: '가입 거절' },
};

type FilterMode = 'all' | 'unread';

// ── Main Component ─────────────────────────────────────────────────────

function InboxPage() {
  Route.useParams();
  useWorkspaceContext();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterMode>('all');
  const [activeId, setActiveId] = useState<string | null>(null);

  const notificationsQuery = useInfiniteQuery<ListResponse<NotificationOutput>>({
    queryKey: ['my', 'notifications'],
    queryFn: ({ pageParam }) => {
      const params: Record<string, string> = { limit: '30' };
      if (pageParam) params.cursor = pageParam as string;
      return apiClient.getList<NotificationOutput>('/my/notifications', params);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more ? (lastPage.pagination.next_cursor ?? undefined) : undefined,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.patch(`/notifications/${notificationId}`, { read: true }),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['my', 'notifications'] });
      const previousData = queryClient.getQueryData(['my', 'notifications']);
      queryClient.setQueryData(
        ['my', 'notifications'],
        (old: ReturnType<typeof notificationsQuery.data> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: ListResponse<NotificationOutput>) => ({
              ...page,
              data: page.data.map((n: NotificationOutput) =>
                n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
              ),
            })),
          };
        },
      );
      queryClient.setQueryData(
        ['my', 'notifications', 'unread-count'],
        (old: { count: number } | undefined) => (old ? { count: Math.max(0, old.count - 1) } : old),
      );
      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my', 'notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications', 'unread-count'] });
    },
  });

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
      queryClient.setQueryData(['my', 'notifications', 'unread-count'], { count: 0 });
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my', 'notifications'], context.previousData);
      }
      toast.error('읽음 처리에 실패했습니다.');
    },
    onSuccess: () => {
      toast('모든 알림이 읽음 처리되었습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['my', 'notifications', 'unread-count'] });
    },
  });

  const handleSelect = useCallback(
    (notification: NotificationOutput) => {
      setActiveId(notification.id);
      if (!notification.readAt) markReadMutation.mutate(notification.id);
    },
    [markReadMutation],
  );

  const allNotifications = notificationsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const filtered =
    filter === 'unread' ? allNotifications.filter((n) => !n.readAt) : allNotifications;
  const unreadCount = allNotifications.filter((n) => !n.readAt).length;

  const active = useMemo(
    () => filtered.find((n) => n.id === activeId) ?? filtered[0] ?? null,
    [filtered, activeId],
  );

  // Loading state
  if (notificationsQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-[48px] shrink-0 items-center gap-3 border-b border-[color:var(--border-subtle)] px-[14px]">
          <h1 className="text-[13px] font-medium text-foreground">받은 알림</h1>
        </div>
        <div className="grid h-full grid-cols-[380px_1fr]">
          <div className="border-r border-[color:var(--border-subtle)] bg-[color:var(--panel)] p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="mb-2 h-16 w-full rounded-md" />
            ))}
          </div>
          <div />
        </div>
      </div>
    );
  }

  // Error state
  if (notificationsQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-[14px]">
          <h1 className="text-[13px] font-medium text-foreground">받은 알림</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Bell className="mx-auto h-12 w-12 text-[color:var(--fg-faint)]" />
            <p className="mt-2 text-sm text-[color:var(--fg-dim)]">알림을 불러올 수 없습니다.</p>
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
    <div className="flex h-full min-h-0 flex-col">
      {/* Topbar */}
      <div className="flex h-[48px] shrink-0 items-center gap-3 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg)] px-[14px]">
        <h1 className="text-[13px] font-medium text-foreground">받은 알림</h1>
        <div className="ml-auto flex items-center gap-1">
          <Chip
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-3 w-3" />
            모두 읽음
          </Chip>
          <Chip>
            <Filter className="h-3 w-3" />
            필터
          </Chip>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex h-10 shrink-0 items-center gap-0 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg)] px-[14px]">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`inline-flex items-center gap-[6px] rounded-sm px-[9px] py-[3px] text-[12px] transition-colors ${
            filter === 'all'
              ? 'bg-[color:var(--panel)] text-foreground shadow-[var(--shadow-sm)]'
              : 'text-[color:var(--fg-dim)] hover:text-foreground'
          }`}
        >
          전체 <Kbd className="ml-1">{allNotifications.length}</Kbd>
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`ml-[2px] inline-flex items-center gap-[6px] rounded-sm px-[9px] py-[3px] text-[12px] transition-colors ${
            filter === 'unread'
              ? 'bg-[color:var(--panel)] text-foreground shadow-[var(--shadow-sm)]'
              : 'text-[color:var(--fg-dim)] hover:text-foreground'
          }`}
        >
          읽지 않음 <Kbd className="ml-1">{unreadCount}</Kbd>
        </button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="새로운 알림이 없습니다"
          description="알림이 도착하면 여기에 표시됩니다"
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[380px_1fr]">
          {/* List pane */}
          <div
            className="min-h-0 overflow-auto border-r border-[color:var(--border-subtle)] bg-[color:var(--panel)]"
            role="list"
            aria-label="알림 목록"
          >
            {filtered.map((n) => {
              const cfg = NOTIFICATION_ICON_MAP[n.type];
              const Icon = cfg.icon;
              const isUnread = !n.readAt;
              const isActive = active?.id === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-label={n.message}
                  onClick={() => handleSelect(n)}
                  className={`relative flex w-full flex-col gap-[6px] border-b border-[color:var(--border-subtle)] px-[14px] py-3 text-left transition-colors ${
                    isActive ? 'bg-[color:var(--bg-sel)]' : 'hover:bg-[color:var(--bg-hover)]'
                  }`}
                >
                  {isUnread && (
                    <span className="absolute left-[6px] top-[17px] h-[6px] w-[6px] rounded-full bg-[color:var(--accent)]" />
                  )}
                  <div className="flex items-center gap-2 text-[12px] text-[color:var(--fg-mid)]">
                    <Icon className="h-[14px] w-[14px] shrink-0 text-[color:var(--fg-dim)]" />
                    <span className="font-medium text-foreground">{cfg.label}</span>
                    <span className="ml-auto font-mono text-[11px] text-[color:var(--fg-faint)]">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  <div className="truncate pl-[22px] text-[12.5px] leading-[1.45] text-[color:var(--fg-mid)]">
                    {n.message}
                  </div>
                </button>
              );
            })}

            {notificationsQuery.hasNextPage && (
              <div className="flex justify-center py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => notificationsQuery.fetchNextPage()}
                  disabled={notificationsQuery.isFetchingNextPage}
                >
                  {notificationsQuery.isFetchingNextPage ? '불러오는 중...' : '더 보기'}
                </Button>
              </div>
            )}
          </div>

          {/* Detail pane */}
          <div className="min-h-0 overflow-auto px-[40px] py-[30px]">
            {active ? (
              <div className="mx-auto max-w-[680px]">
                <div className="mb-[6px] font-mono text-[11px] text-[color:var(--fg-faint)]">
                  {NOTIFICATION_ICON_MAP[active.type].label}
                </div>
                <h2
                  className="mb-5 text-[30px] font-normal leading-tight tracking-[-0.02em] text-foreground"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {active.message}
                </h2>
                <div className="mb-6 flex items-center gap-[10px]">
                  <div className="font-mono text-[11.5px] text-[color:var(--fg-faint)]">
                    {formatRelativeTime(active.createdAt)}
                  </div>
                  {active.readAt && (
                    <div className="font-mono text-[11.5px] text-[color:var(--fg-faint)]">
                      · 읽음
                    </div>
                  )}
                </div>

                <div className="my-7 h-px bg-[color:var(--border-subtle)]" />

                <div className="flex items-center gap-[10px] text-[12px] text-[color:var(--fg-dim)]">
                  <Kbd>E</Kbd> 읽음 처리
                  <span className="px-1">·</span>
                  <Kbd>J</Kbd> 다음 <Kbd>K</Kbd> 이전
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[color:var(--fg-dim)]">
                알림을 선택하세요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
