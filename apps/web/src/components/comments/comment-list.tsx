import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';
import type { MentionQueryFn } from '@worknest/editor';
import type { ActivityOutput } from '@worknest/shared';
import { Skeleton, cn, toast } from '@worknest/ui';
import {
  AlertTriangle,
  Calendar,
  Layers,
  ListPlus,
  MessageSquare,
  Plus,
  RefreshCw,
  Tag,
  UserPlus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWebSocket } from '../../hooks/use-websocket';
import { useWebSocketEvent } from '../../hooks/use-websocket-event';
import { type ListResponse, apiClient } from '../../lib/api-client';
import { formatRelativeTime } from '../../lib/format-time';
import { useAuthStore } from '../../stores/auth-store';
import { CommentEditor } from './comment-editor';
import { type CommentData, CommentItem } from './comment-item';

// ── Types ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'comments' | 'activities';

interface CommentListProps {
  /** Issue ID */
  issueId?: string;
  /** Project ID (needed for activity queries) */
  projectId?: string;
  /** Mention query function */
  mentionQueryFn?: MentionQueryFn;
}

// ── Timeline entry union ───────────────────────────────────────────────

interface TimelineComment {
  type: 'comment';
  timestamp: string;
  data: CommentData;
}

interface TimelineActivity {
  type: 'activity';
  timestamp: string;
  data: ActivityOutput;
}

type TimelineEntry = TimelineComment | TimelineActivity;

// ── Activity icon/description helpers ──────────────────────────────────

function getActivityIcon(action: string) {
  switch (action) {
    case 'status_changed':
      return <RefreshCw size={18} className="text-blue-500" />;
    case 'priority_changed':
      return <AlertTriangle size={18} className="text-orange-500" />;
    case 'assignee_added':
    case 'assignee_removed':
      return <UserPlus size={18} className="text-green-500" />;
    case 'label_added':
    case 'label_removed':
      return <Tag size={18} className="text-purple-500" />;
    case 'due_date_changed':
      return <Calendar size={18} className="text-amber-500" />;
    case 'type_changed':
      return <Layers size={18} className="text-teal-500" />;
    case 'created':
      return <Plus size={18} className="text-green-500" />;
    case 'sub_issue_added':
      return <ListPlus size={18} className="text-blue-500" />;
    default:
      return <RefreshCw size={18} className="text-muted-foreground" />;
  }
}

function getActivityDescription(activity: ActivityOutput): string {
  const { action, field, oldValue, newValue } = activity;

  switch (action) {
    case 'created':
      return '이슈를 생성함';
    case 'updated': {
      if (!field) return '이슈를 수정함';
      const fieldLabels: Record<string, string> = {
        title: '제목',
        description: '설명',
        status: '상태',
        type: '타입',
        priority: '우선순위',
        dueDate: '마감일',
        parent: '상위 이슈',
        sortOrder: '정렬 순서',
      };
      const label = fieldLabels[field] ?? field;
      if (oldValue && newValue) return `${label}을(를) ${oldValue}에서 ${newValue}으로 변경`;
      if (newValue) return `${label}을(를) ${newValue}으로 설정`;
      if (oldValue) return `${label}을(를) 제거`;
      return `${label}을(를) 수정함`;
    }
    case 'status_changed':
      return `상태를 ${oldValue ?? '없음'}에서 ${newValue ?? '없음'}으로 변경`;
    case 'priority_changed':
      return `우선순위를 ${oldValue ?? '없음'}에서 ${newValue ?? '없음'}으로 변경`;
    case 'assignee_added':
      return `${newValue ?? '사용자'}을(를) 담당자로 추가`;
    case 'assignee_removed':
      return `${oldValue ?? '사용자'}을(를) 담당자에서 제거`;
    case 'label_added':
      return `${newValue ?? '라벨'} 라벨을 추가`;
    case 'label_removed':
      return `${oldValue ?? '라벨'} 라벨을 제거`;
    case 'type_changed':
      return `타입을 ${oldValue ?? '없음'}에서 ${newValue ?? '없음'}으로 변경`;
    case 'title_changed':
      return '제목을 변경함';
    case 'description_changed':
      return '설명을 수정함';
    case 'due_date_changed':
      return newValue ? `마감일을 ${newValue}으로 설정` : '마감일을 제거';
    case 'parent_changed':
      return newValue ? '상위 이슈를 설정함' : '상위 이슈를 제거함';
    default:
      return action.replace(/_/g, ' ');
  }
}

// ── Activity item ──────────────────────────────────────────────────────

function ActivityItem({ activity }: { activity: ActivityOutput }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2" role="article" aria-label="활동 로그">
      <div className="mt-0.5 shrink-0">{getActivityIcon(activity.action)}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{activity.actor?.name ?? '시스템'}</span>
          <span className="mx-1">&middot;</span>
          <span className="text-xs">{formatRelativeTime(activity.createdAt)}</span>
        </p>
        <p className="text-sm text-muted-foreground">{getActivityDescription(activity)}</p>
      </div>
    </div>
  );
}

// ── Filter Tabs ────────────────────────────────────────────────────────

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'comments', label: '댓글' },
  { value: 'activities', label: '활동' },
];

function FilterTabs({
  value,
  onChange,
}: {
  value: FilterTab;
  onChange: (tab: FilterTab) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="필터">
      {FILTER_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'h-9 rounded-md px-3 py-1.5 text-sm transition-colors',
            value === tab.value
              ? 'bg-secondary font-medium text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="댓글 및 활동 로딩 중">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty states ───────────────────────────────────────────────────────

function EmptyComments() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <MessageSquare size={32} className="text-muted-foreground/50" />
      <p className="mt-2 text-sm text-muted-foreground">아직 댓글이 없습니다</p>
      <p className="mt-1 text-xs text-muted-foreground/70">첫 번째 댓글을 작성해 보세요</p>
    </div>
  );
}

function EmptyActivities() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <p className="text-sm text-muted-foreground">활동 기록이 없습니다</p>
    </div>
  );
}

// ── Main CommentList ───────────────────────────────────────────────────

export function CommentList({ issueId, projectId, mentionQueryFn }: CommentListProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? '';

  // Determine API paths and query keys
  const commentsPath = issueId ? `/issues/${issueId}/comments` : null;

  const commentsQueryKey = issueId ? ['issues', issueId, 'comments'] : [];

  const activitiesQueryKey =
    projectId && issueId ? ['projects', projectId, 'issues', issueId, 'activities'] : [];

  // ── WebSocket subscription ─────────────────────────────────────────

  const wsChannel = issueId ? `issue:${issueId}` : '';

  const wsChannels = useMemo(() => (wsChannel ? [wsChannel] : []), [wsChannel]);
  useWebSocket(wsChannels);

  useWebSocketEvent('comment.created', () => {
    if (commentsQueryKey.length) {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    }
  });

  useWebSocketEvent('comment.updated', () => {
    if (commentsQueryKey.length) {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    }
  });

  useWebSocketEvent('comment.deleted', () => {
    if (commentsQueryKey.length) {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    }
  });

  useWebSocketEvent('reaction.toggled', () => {
    if (commentsQueryKey.length) {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    }
  });

  // ── Queries ────────────────────────────────────────────────────────

  const commentsQuery = useQuery<{ data: CommentData[] }>({
    queryKey: commentsQueryKey,
    queryFn: () =>
      commentsPath ? apiClient.getList<CommentData>(commentsPath) : Promise.resolve({ data: [] }),
    enabled: !!commentsPath,
  });

  const activitiesQuery = useQuery<ListResponse<ActivityOutput>>({
    queryKey: activitiesQueryKey,
    queryFn: () =>
      projectId && issueId
        ? apiClient.getList<ActivityOutput>(`/projects/${projectId}/issues/${issueId}/activities`)
        : Promise.resolve({ data: [], pagination: { next_cursor: null, has_more: false } }),
    enabled: !!projectId && !!issueId,
  });

  // ── Mutations ──────────────────────────────────────────────────────

  const createComment = useMutation({
    mutationFn: (body: { content: JSONContent; parentId?: string }) =>
      apiClient.post<CommentData>(commentsPath!, body),
    onMutate: async (newComment) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous = queryClient.getQueryData<{ data: CommentData[] }>(commentsQueryKey);
      queryClient.setQueryData<{ data: CommentData[] }>(commentsQueryKey, (old) => ({
        data: [
          ...(old?.data ?? []),
          {
            id: `temp-${Date.now()}`,
            issueId: issueId ?? null,
            pageId: null,
            content: newComment.content,
            parentId: newComment.parentId ?? null,
            authorId: currentUserId,
            author: currentUser
              ? {
                  id: currentUser.id,
                  name: currentUser.name,
                  email: currentUser.email,
                  avatarUrl: currentUser.avatarUrl,
                }
              : null,
            resolvedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reactions: [],
          },
        ],
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsQueryKey, context.previous);
      }
      toast.error('댓글 작성에 실패했습니다');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    },
  });

  const updateComment = useMutation({
    mutationFn: ({
      commentId,
      content,
    }: {
      commentId: string;
      content: JSONContent;
    }) => apiClient.patch<CommentData>(`/comments/${commentId}`, { content }),
    onMutate: async ({ commentId, content }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous = queryClient.getQueryData<{ data: CommentData[] }>(commentsQueryKey);
      queryClient.setQueryData<{ data: CommentData[] }>(commentsQueryKey, (old) => ({
        data: (old?.data ?? []).map((c) =>
          c.id === commentId ? { ...c, content, updatedAt: new Date().toISOString() } : c,
        ),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsQueryKey, context.previous);
      }
      toast.error('댓글 수정에 실패했습니다');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => apiClient.delete(`/comments/${commentId}`),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous = queryClient.getQueryData<{ data: CommentData[] }>(commentsQueryKey);
      queryClient.setQueryData<{ data: CommentData[] }>(commentsQueryKey, (old) => ({
        data: (old?.data ?? []).filter((c) => c.id !== commentId),
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsQueryKey, context.previous);
      }
      toast.error('댓글 삭제에 실패했습니다');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      toast.success('댓글이 삭제되었습니다');
    },
  });

  const toggleReaction = useMutation({
    mutationFn: ({
      commentId,
      emoji,
    }: {
      commentId: string;
      emoji: string;
    }) =>
      apiClient.post<{ added: boolean; commentId: string; emoji: string }>(
        `/comments/${commentId}/reactions`,
        { emoji },
      ),
    onMutate: async ({ commentId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: commentsQueryKey });
      const previous = queryClient.getQueryData<{ data: CommentData[] }>(commentsQueryKey);

      queryClient.setQueryData<{ data: CommentData[] }>(commentsQueryKey, (old) => ({
        data: (old?.data ?? []).map((c) => {
          if (c.id !== commentId) return c;

          const existingReaction = c.reactions.find(
            (r) => r.emoji === emoji && r.userId === currentUserId,
          );

          if (existingReaction) {
            // Remove own reaction
            return {
              ...c,
              reactions: c.reactions.filter((r) => r.id !== existingReaction.id),
            };
          }

          // Add own reaction
          return {
            ...c,
            reactions: [
              ...c.reactions,
              {
                id: `temp-${Date.now()}`,
                commentId,
                userId: currentUserId,
                emoji,
                createdAt: new Date().toISOString(),
                user: currentUser
                  ? {
                      id: currentUser.id,
                      name: currentUser.name,
                      avatarUrl: currentUser.avatarUrl,
                    }
                  : null,
              },
            ],
          };
        }),
      }));

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
    },
  });

  // ── Build timeline ─────────────────────────────────────────────────

  const allComments = commentsQuery.data?.data ?? [];
  const activities = activitiesQuery.data?.data ?? [];

  // Split top-level comments and replies
  const topLevelComments = allComments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, CommentData[]>();
  for (const c of allComments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    }
  }

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];

    if (filter !== 'activities') {
      for (const comment of topLevelComments) {
        entries.push({
          type: 'comment',
          timestamp: comment.createdAt,
          data: comment,
        });
      }
    }

    if (filter !== 'comments') {
      for (const activity of activities) {
        entries.push({
          type: 'activity',
          timestamp: activity.createdAt,
          data: activity,
        });
      }
    }

    // Sort chronologically (oldest first)
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return entries;
  }, [topLevelComments, activities, filter]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleCreateComment = (content: JSONContent) => {
    if (!commentsPath) return;
    createComment.mutate({ content });
  };

  const handleCreateReply = (parentId: string, content: JSONContent) => {
    if (!commentsPath) return;
    createComment.mutate({ content, parentId });
    setReplyingTo(null);
  };

  const handleEdit = (commentId: string, content: JSONContent) => {
    updateComment.mutate({ commentId, content });
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate(commentId);
  };

  const handleReactionToggle = (commentId: string, emoji: string) => {
    toggleReaction.mutate({ commentId, emoji });
  };

  // ── Loading state ──────────────────────────────────────────────────

  if (commentsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">댓글 &amp; 활동</h3>
        <TimelineSkeleton />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────

  if (commentsQuery.isError) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">댓글 &amp; 활동</h3>
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">댓글을 불러오는데 실패했습니다.</p>
          <button
            type="button"
            className="mt-2 text-sm text-primary hover:underline"
            onClick={() => commentsQuery.refetch()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  const isEmpty =
    (filter === 'all' && timeline.length === 0) ||
    (filter === 'comments' && topLevelComments.length === 0) ||
    (filter === 'activities' && activities.length === 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">댓글 &amp; 활동</h3>

      {/* Filter tabs */}
      <FilterTabs value={filter} onChange={setFilter} />

      {/* Timeline */}
      <div className="space-y-4" role="feed" aria-label="댓글 및 활동">
        {isEmpty ? (
          filter === 'activities' ? (
            <EmptyActivities />
          ) : (
            <EmptyComments />
          )
        ) : (
          timeline.map((entry) => {
            if (entry.type === 'activity') {
              return <ActivityItem key={`activity-${entry.data.id}`} activity={entry.data} />;
            }

            // Comment + its replies
            const comment = entry.data;
            const replies = repliesByParent.get(comment.id) ?? [];

            return (
              <div key={`comment-${comment.id}`} className="space-y-3">
                <CommentItem
                  comment={comment}
                  currentUserId={currentUserId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReply={(parentId) => setReplyingTo(parentId)}
                  onReactionToggle={handleReactionToggle}
                  mentionQueryFn={mentionQueryFn}
                />

                {/* Replies */}
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    isReply
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReply={(parentId) => setReplyingTo(parentId)}
                    onReactionToggle={handleReactionToggle}
                    mentionQueryFn={mentionQueryFn}
                  />
                ))}

                {/* Reply editor (inline under parent) */}
                {replyingTo === comment.id && (
                  <div className="ml-8 border-l-2 border-border pl-4">
                    <CommentEditor
                      onSubmit={(content) => handleCreateReply(comment.id, content)}
                      onCancel={() => setReplyingTo(null)}
                      submitLabel="답글"
                      placeholder="답글 작성..."
                      mentionQueryFn={mentionQueryFn}
                      autofocus
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New comment editor (always at bottom) */}
      <div aria-live="polite">
        <CommentEditor
          onSubmit={handleCreateComment}
          mentionQueryFn={mentionQueryFn}
          isSubmitting={createComment.isPending}
        />
      </div>
    </div>
  );
}
