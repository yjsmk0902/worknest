import { useQuery } from '@tanstack/react-query';
import { Avatar, Skeleton } from '@worknest/ui';
import { apiClient, type ListResponse } from '../../../lib/api-client';
import type { ActivityOutput } from '@worknest/shared';

interface IssueActivityProps {
  projectId: string;
  issueId: string;
}

// ── Action display config ───────────────────────────────────────────────

function getActionDescription(activity: ActivityOutput): string {
  const { action, field, oldValue, newValue } = activity;

  switch (action) {
    case 'created':
      return '이슈를 생성함';
    case 'updated': {
      if (!field) return '이슈를 수정함';
      return getFieldChangeDescription(field, oldValue, newValue);
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
      return `제목을 변경함`;
    case 'description_changed':
      return '설명을 수정함';
    case 'due_date_changed':
      return newValue
        ? `마감일을 ${newValue}으로 설정`
        : '마감일을 제거';
    case 'parent_changed':
      return newValue
        ? '상위 이슈를 설정함'
        : '상위 이슈를 제거함';
    default:
      return action.replace(/_/g, ' ');
  }
}

function getFieldChangeDescription(
  field: string,
  oldValue: string | null,
  newValue: string | null,
): string {
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

  if (oldValue && newValue) {
    return `${label}을(를) ${oldValue}에서 ${newValue}으로 변경`;
  }
  if (newValue) {
    return `${label}을(를) ${newValue}으로 설정`;
  }
  if (oldValue) {
    return `${label}을(를) 제거`;
  }
  return `${label}을(를) 수정함`;
}

// ── Relative time formatting ────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}주 전`;

  return date.toLocaleDateString('ko-KR');
}

// ── Main Component ──────────────────────────────────────────────────────

export function IssueActivity({ projectId, issueId }: IssueActivityProps) {
  const activitiesQuery = useQuery<ListResponse<ActivityOutput>>({
    queryKey: ['projects', projectId, 'issues', issueId, 'activities'],
    queryFn: () =>
      apiClient.getList<ActivityOutput>(
        `/projects/${projectId}/issues/${issueId}/activities`,
      ),
  });

  if (activitiesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">활동</h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const activities = activitiesQuery.data?.data ?? [];

  if (activities.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">활동</h3>
        <p className="text-sm text-muted-foreground">아직 활동이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">활동</h3>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3">
            {/* Actor avatar */}
            <Avatar
              src={activity.actor?.avatarUrl ?? null}
              fallback={activity.actor?.name ?? '?'}
              size="sm"
              className="mt-0.5 shrink-0"
            />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">
                  {activity.actor?.name ?? '시스템'}
                </span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {formatRelativeTime(activity.createdAt)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {getActionDescription(activity)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
