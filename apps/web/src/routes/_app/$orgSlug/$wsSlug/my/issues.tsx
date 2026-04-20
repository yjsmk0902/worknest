import { IssueDetailPanel } from '@/components/issues/issue-detail/issue-detail-panel';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '@/lib/issue-constants';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { StatusCategory } from '@worknest/shared';
import { Button, Skeleton } from '@worknest/ui';
import { AlertTriangle, CircleUser } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/my/issues')({
  component: MyIssuesPage,
});

// ── Types ──────────────────────────────────────────────────────────────

interface MyIssueStatus {
  id: string;
  name: string;
  color: string;
  category: string;
}

interface MyIssueProject {
  id: string;
  name: string;
  prefix: string;
}

interface MyIssue {
  id: string;
  projectId: string;
  sequenceId: number;
  title: string;
  statusId: string | null;
  priority: string;
  sortOrder: string;
  status: MyIssueStatus | null;
  project: MyIssueProject;
}

type GroupedIssues = Record<StatusCategory, MyIssue[]>;

// Status category display order when flattening grouped response
const CATEGORY_ORDER: StatusCategory[] = [
  'started',
  'unstarted',
  'backlog',
  'completed',
  'cancelled',
];

// ── Main Component ─────────────────────────────────────────────────────

function MyIssuesPage() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<{
    issueId: string;
    projectId: string;
    projectPrefix: string;
  } | null>(null);

  const myIssuesQuery = useQuery<GroupedIssues>({
    queryKey: ['workspaces', wsId, 'my-issues'],
    queryFn: () => apiClient.get<GroupedIssues>(`/workspaces/${wsId}/my-issues`),
    staleTime: 30 * 1000,
  });

  const handleIssueClick = useCallback((issue: MyIssue) => {
    setSelected({
      issueId: issue.id,
      projectId: issue.projectId,
      projectPrefix: issue.project.prefix,
    });
  }, []);

  // Esc to close panel
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Flatten grouped issues in a sensible order
  const issues = useMemo(() => {
    if (!myIssuesQuery.data) return [];
    return CATEGORY_ORDER.flatMap((cat) => myIssuesQuery.data[cat] ?? []);
  }, [myIssuesQuery.data]);

  const totalIssues = issues.length;

  // Loading state
  if (myIssuesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-10 pt-10 pb-6">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
        <div className="flex-1" aria-busy="true" aria-label="이슈 로딩 중">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={`row-${i}`}
              className="mx-0 h-[52px] rounded-none border-b border-[color:var(--border-subtle)]"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (myIssuesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-10 pt-10 pb-6">
          <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-[color:var(--fg-1)]">
            내 이슈
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-[color:var(--priority-urgent)]" />
            <p className="mt-2 text-sm text-[color:var(--fg-3)]">이슈를 불러올 수 없습니다.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => myIssuesQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (totalIssues === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-10 pt-10 pb-6">
          <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-[color:var(--fg-1)]">
            내 이슈
          </h1>
          <p className="mt-2 text-[13px] text-[color:var(--fg-3)]">나에게 할당된 이슈 0개</p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
          <CircleUser className="h-12 w-12 text-[color:var(--fg-4)]" />
          <p className="text-lg font-medium text-[color:var(--fg-1)]">할당된 이슈가 없습니다</p>
          <p className="text-sm text-[color:var(--fg-3)]">이슈에 할당되면 여기에 표시됩니다</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() =>
              navigate({
                to: '/$orgSlug/$wsSlug/projects',
                params: { orgSlug, wsSlug },
              })
            }
          >
            프로젝트로 이동
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-10 pt-10 pb-8">
        <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-[color:var(--fg-1)]">
          내 이슈
        </h1>
        <p className="mt-2 text-[13px] text-[color:var(--fg-3)]">
          나에게 할당된 이슈 {totalIssues}개
        </p>
      </div>

      {/* Flat list */}
      <div className="flex-1 overflow-y-auto">
        {issues.map((issue) => {
          const priorityKey = (issue.priority || 'none') as Priority;
          const priorityConfig = PRIORITY_CONFIG[priorityKey] ?? PRIORITY_CONFIG.none;
          const PriorityIcon = priorityConfig.icon;
          const issueKey = `${issue.project.prefix}-${issue.sequenceId}`;
          const statusCategory = issue.status?.category as StatusCategory | undefined;

          return (
            <button
              key={issue.id}
              type="button"
              onClick={() => handleIssueClick(issue)}
              className="group flex h-[52px] w-full cursor-pointer items-center gap-4 border-b border-[color:var(--border-subtle)] px-6 text-left transition-colors hover:bg-[color:var(--bg-2)]"
            >
              {/* Priority indicator */}
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                <PriorityIcon className={`h-[14px] w-[14px] ${priorityConfig.color}`} />
              </span>

              {/* Issue key (monospace) */}
              <span className="w-[72px] shrink-0 font-mono text-[11.5px] text-[color:var(--fg-4)]">
                {issueKey}
              </span>

              {/* Status dot */}
              {issue.status ? (
                <span
                  className="relative h-3 w-3 shrink-0 rounded-full border-[1.5px]"
                  style={{
                    borderColor:
                      statusCategory === 'completed' ? 'transparent' : issue.status.color,
                    background:
                      statusCategory === 'completed' || statusCategory === 'cancelled'
                        ? issue.status.color
                        : statusCategory === 'started'
                          ? `conic-gradient(${issue.status.color} 60%, transparent 60%)`
                          : 'transparent',
                  }}
                  aria-label={issue.status.name}
                  title={issue.status.name}
                />
              ) : (
                <span
                  className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-[color:var(--fg-4)]"
                  aria-hidden="true"
                />
              )}

              {/* Title */}
              <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--fg-1)]">
                {issue.title}
              </span>

              {/* Assignee avatar — placeholder (backend doesn't return assignees on this endpoint yet) */}
              <span className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--amber-500)] text-[10px] font-semibold text-[color:var(--accent-fg)]">
                양
              </span>
            </button>
          );
        })}
      </div>

      {/* Side panel with blurred backdrop */}
      {selected && (
        <IssueDetailPanel
          issueId={selected.issueId}
          projectId={selected.projectId}
          projectPrefix={selected.projectPrefix}
          orgSlug={orgSlug}
          wsSlug={wsSlug}
          mode="panel"
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
