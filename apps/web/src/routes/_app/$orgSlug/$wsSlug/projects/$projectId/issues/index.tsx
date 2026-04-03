import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CircleCheck,
  Plus,
} from 'lucide-react';
import { Avatar, Button, Skeleton } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { apiClient, type ListResponse } from '../../../../../../lib/api-client';
import { TYPE_ICON_MAP, PRIORITY_CONFIG, type Priority } from '../../../../../../lib/issue-constants';
import { useWorkspaceContext } from '../../../../../../contexts/workspace-context';
import { AppHeader } from '../../../../../../components/layout/app-header';
import { QuickAdd } from '../../../../../../components/issues/quick-add';
import { IssueDetailPanel } from '../../../../../../components/issues/issue-detail/issue-detail-panel';
import type { IssueOutput } from '@worknest/shared';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/issues/',
)({
  component: IssueListPage,
});

// ── Project type ────────────────────────────────────────────────────────

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

// ── Main Component ──────────────────────────────────────────────────────

function IssueListPage() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Fetch project info
  const projectQuery = useQuery<ProjectOutput>({
    queryKey: ['projects', projectId],
    queryFn: () =>
      apiClient.get<ProjectOutput>(
        `/workspaces/${wsId}/projects/${projectId}`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch issues
  const issuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'issues'],
    queryFn: () =>
      apiClient.getList<IssueOutput>(
        `/projects/${projectId}/issues`,
      ),
  });

  const project = projectQuery.data;
  const issues = issuesQuery.data?.data ?? [];
  const projectPrefix = project?.prefix ?? '...';

  // Loading state
  if (projectQuery.isLoading || issuesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader
          title=""
          actions={<Skeleton className="h-9 w-24" />}
        />
        <div className="flex-1 p-4">
          <IssueListSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (projectQuery.isError || issuesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="Issues" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              이슈를 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                projectQuery.refetch();
                issuesQuery.refetch();
              }}
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
      <AppHeader
        title={`${projectPrefix} Issues`}
        breadcrumbs={[{ label: project?.name ?? '' }]}
        actions={
          <Button
            size="sm"
            onClick={() => setShowQuickAdd(true)}
            aria-label="이슈 추가"
          >
            <Plus className="h-4 w-4" />
            <span>이슈</span>
          </Button>
        }
      />

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] p-4">
          {/* Quick Add at top */}
          {showQuickAdd && (
            <div className="mb-2">
              <QuickAdd
                projectId={projectId}
                onClose={() => setShowQuickAdd(false)}
              />
            </div>
          )}

          {/* Empty state */}
          {issues.length === 0 && !showQuickAdd && (
            <div className="flex flex-col items-center justify-center py-24">
              <CircleCheck className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                아직 이슈가 없습니다
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                첫 번째 이슈를 만들어 프로젝트를 시작하세요.
              </p>
              <Button
                className="mt-4"
                onClick={() => setShowQuickAdd(true)}
              >
                <Plus className="h-4 w-4" />
                이슈 만들기
              </Button>
            </div>
          )}

          {/* Issue rows */}
          {issues.length > 0 && (
            <div className="rounded-lg border border-border">
              {/* Table header */}
              <div className="flex h-9 items-center gap-3 border-b border-border bg-muted/50 px-3 text-xs font-medium text-muted-foreground">
                <span className="w-[80px]">키</span>
                <span className="flex-1">제목</span>
                <span className="w-[100px]">상태</span>
                <span className="w-[60px]">우선순위</span>
                <span className="w-[80px]">담당자</span>
                <span className="w-[90px]">마감일</span>
              </div>

              {issues.map((issue) => {
                const isTemp = issue.id.startsWith('temp-');
                const issueKey = isTemp
                  ? '...'
                  : `${projectPrefix}-${issue.sequenceId}`;

                const priorityConfig =
                  PRIORITY_CONFIG[issue.priority as Priority] ??
                  PRIORITY_CONFIG.none;
                const PriorityIcon = priorityConfig.icon;

                const TypeIcon = issue.type?.icon
                  ? (TYPE_ICON_MAP[issue.type.icon] ?? CircleCheck)
                  : CircleCheck;

                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => {
                      if (!isTemp) {
                        setSelectedIssueId(issue.id);
                      }
                    }}
                    disabled={isTemp}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors hover:bg-accent last:border-b-0',
                      isTemp && 'pointer-events-none opacity-70',
                      selectedIssueId === issue.id && 'bg-accent',
                    )}
                    aria-busy={isTemp}
                    aria-label={isTemp ? '생성 중...' : undefined}
                  >
                    {/* Issue key */}
                    <span className="w-[80px] shrink-0 font-mono text-xs text-muted-foreground">
                      {issueKey}
                    </span>

                    {/* Title with type icon */}
                    <div className="flex flex-1 items-center gap-2 overflow-hidden">
                      <TypeIcon
                        className="h-4 w-4 shrink-0"
                        style={{
                          color: issue.type?.color ?? undefined,
                        }}
                      />
                      <span className="truncate">{issue.title}</span>
                    </div>

                    {/* Status badge */}
                    <div className="w-[100px] shrink-0">
                      {issue.status && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: issue.status.color,
                            }}
                          />
                          <span className="truncate">
                            {issue.status.name}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Priority */}
                    <div className="flex w-[60px] shrink-0 justify-center">
                      <PriorityIcon
                        className={cn('h-4 w-4', priorityConfig.color)}
                      />
                    </div>

                    {/* Assignees */}
                    <div className="flex w-[80px] shrink-0 items-center gap-[-4px]">
                      {issue.assignees &&
                        issue.assignees.slice(0, 3).map((a) => (
                          <Avatar
                            key={a.id}
                            src={a.user.avatarUrl}
                            fallback={a.user.name}
                            size="sm"
                            className="-ml-1 first:ml-0"
                          />
                        ))}
                      {issue.assignees && issue.assignees.length > 3 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          +{issue.assignees.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Due date */}
                    <span className="w-[90px] shrink-0 text-xs text-muted-foreground">
                      {issue.dueDate
                        ? new Date(issue.dueDate).toLocaleDateString(
                            'ko-KR',
                            { month: 'short', day: 'numeric' },
                          )
                        : ''}
                    </span>
                  </button>
                );
              })}

              {/* Add issue button at bottom */}
              {!showQuickAdd && (
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(true)}
                  className="flex h-9 w-full items-center gap-2 px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="이슈 추가"
                >
                  <Plus className="h-4 w-4" />
                  <span>이슈 추가</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Side panel for issue detail */}
      {selectedIssueId && (
        <IssueDetailPanel
          issueId={selectedIssueId}
          projectId={projectId}
          projectPrefix={projectPrefix}
          orgSlug={orgSlug}
          wsSlug={wsSlug}
          mode="panel"
          onClose={() => setSelectedIssueId(null)}
        />
      )}
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────

function IssueListSkeleton() {
  return (
    <div className="mx-auto max-w-[960px]">
      <div className="rounded-lg border border-border">
        <div className="flex h-9 items-center gap-3 border-b border-border bg-muted/50 px-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
          >
            <Skeleton className="h-4 w-[70px]" />
            <div className="flex flex-1 items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
