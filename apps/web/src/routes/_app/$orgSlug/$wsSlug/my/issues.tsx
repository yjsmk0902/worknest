import { IssueDetailPanel } from '@/components/issues/issue-detail/issue-detail-panel';
import { AppHeader } from '@/components/layout/app-header';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '@/lib/issue-constants';
import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  CategoryGlyph,
  type GroupCategory,
} from '@/lib/status-category-config';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { StatusCategory } from '@worknest/shared';
import { Button, Skeleton } from '@worknest/ui';
import { AlertTriangle, ChevronDown, ChevronRight, CircleUser } from 'lucide-react';
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

type GroupedIssues = Partial<Record<StatusCategory, MyIssue[]>>;

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

  const [groupBy, setGroupBy] = useState<'status' | 'project'>('status');

  // Flat list of all issues in category order
  const allIssues = useMemo(() => {
    const data = myIssuesQuery.data;
    if (!data) return [] as MyIssue[];
    return CATEGORY_ORDER.flatMap((cat) => (data[cat as StatusCategory] ?? []) as MyIssue[]);
  }, [myIssuesQuery.data]);

  // Group by status category
  const statusGroups = useMemo(() => {
    const data = myIssuesQuery.data;
    if (!data) return [] as Array<{ key: string; label: string; category: GroupCategory; rows: MyIssue[] }>;
    return CATEGORY_ORDER.map((category) => ({
      key: category,
      label: CATEGORY_CONFIG[category].label,
      category,
      rows: (data[category as StatusCategory] ?? []) as MyIssue[],
    }));
  }, [myIssuesQuery.data]);

  // Group by project (sorted by project name, issues within use original category order)
  const projectGroups = useMemo(() => {
    const byProject = new Map<string, { project: MyIssueProject; rows: MyIssue[] }>();
    for (const issue of allIssues) {
      const entry = byProject.get(issue.projectId);
      if (entry) entry.rows.push(issue);
      else byProject.set(issue.projectId, { project: issue.project, rows: [issue] });
    }
    return Array.from(byProject.values()).sort((a, b) =>
      a.project.name.localeCompare(b.project.name, 'ko'),
    );
  }, [allIssues]);

  const totalIssues = allIssues.length;

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const cat of CATEGORY_ORDER) {
      if (!CATEGORY_CONFIG[cat].defaultOpen) init.add(cat);
    }
    return init;
  });

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Loading state
  if (myIssuesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="내 이슈" />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1040px] px-6 py-10">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-3 h-4 w-48" />
            <div className="mt-8 space-y-2" aria-busy="true" aria-label="이슈 로딩 중">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={`row-${i}`}
                  className="h-[44px] rounded border border-[color:var(--border-subtle)]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (myIssuesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="내 이슈" />
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
        <AppHeader title="내 이슈" />
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
      <AppHeader title="내 이슈" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1040px] px-6 py-10">
          {/* Page intro */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-semibold text-[color:var(--fg-1)]">내 이슈</h1>
              <span className="inline-flex h-[22px] items-center rounded-md bg-[color:var(--bg-3)] px-[8px] font-mono text-[11.5px] font-medium text-[color:var(--fg-2)]">
                {totalIssues}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[color:var(--fg-3)]">
              나에게 할당된 이슈를 {groupBy === 'status' ? '상태별' : '프로젝트별'}로
              확인합니다.
            </p>
          </div>

          {/* Group-by toggle */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[12px] text-[color:var(--fg-3)]">그룹 기준</span>
            <div className="inline-flex h-7 items-center rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] p-[2px]">
              <button
                type="button"
                onClick={() => setGroupBy('status')}
                className={`h-full rounded px-[10px] text-[12px] font-medium transition-colors ${
                  groupBy === 'status'
                    ? 'bg-[color:var(--bg-3)] text-[color:var(--fg-1)]'
                    : 'text-[color:var(--fg-3)] hover:text-[color:var(--fg-1)]'
                }`}
              >
                상태
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('project')}
                className={`h-full rounded px-[10px] text-[12px] font-medium transition-colors ${
                  groupBy === 'project'
                    ? 'bg-[color:var(--bg-3)] text-[color:var(--fg-1)]'
                    : 'text-[color:var(--fg-3)] hover:text-[color:var(--fg-1)]'
                }`}
              >
                프로젝트
              </button>
            </div>
          </div>

          {/* Grouped list */}
          <div className="overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)]">
            {groupBy === 'status'
              ? statusGroups.map(({ key, label, category, rows }) => {
                  if (rows.length === 0) return null;
                  const isCollapsed = collapsed.has(key);
                  return (
                    <section key={key} aria-label={label}>
                      <div className="flex h-10 items-center gap-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-0)] px-4 text-[13px]">
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="grid h-5 w-5 shrink-0 place-items-center text-[color:var(--fg-3)] transition-colors hover:text-[color:var(--fg-1)]"
                          aria-label={`${label} ${isCollapsed ? '펼치기' : '접기'}`}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        <CategoryGlyph category={category} size={14} />
                        <span className="font-medium text-[color:var(--fg-1)]">{label}</span>
                        <span className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md bg-[color:var(--bg-3)] px-[6px] font-mono text-[11px] text-[color:var(--fg-2)]">
                          {rows.length}
                        </span>
                      </div>
                      {!isCollapsed && (
                        <div>
                          {rows.map((issue) => (
                            <MyIssueRow
                              key={issue.id}
                              issue={issue}
                              showProject
                              onClick={() => handleIssueClick(issue)}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })
              : projectGroups.map(({ project, rows }) => {
                  const key = `proj:${project.id}`;
                  const isCollapsed = collapsed.has(key);
                  return (
                    <section key={project.id} aria-label={project.name}>
                      <div className="flex h-10 items-center gap-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-0)] px-4 text-[13px]">
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="grid h-5 w-5 shrink-0 place-items-center text-[color:var(--fg-3)] transition-colors hover:text-[color:var(--fg-1)]"
                          aria-label={`${project.name} ${isCollapsed ? '펼치기' : '접기'}`}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        <span className="font-mono text-[11.5px] text-[color:var(--fg-4)]">
                          {project.prefix}
                        </span>
                        <span className="truncate font-medium text-[color:var(--fg-1)]">
                          {project.name}
                        </span>
                        <span className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md bg-[color:var(--bg-3)] px-[6px] font-mono text-[11px] text-[color:var(--fg-2)]">
                          {rows.length}
                        </span>
                      </div>
                      {!isCollapsed && (
                        <div>
                          {rows.map((issue) => (
                            <MyIssueRow
                              key={issue.id}
                              issue={issue}
                              onClick={() => handleIssueClick(issue)}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
          </div>
        </div>
      </div>

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

// ── Row ────────────────────────────────────────────────────────────────

function MyIssueRow({
  issue,
  onClick,
  showProject = false,
}: {
  issue: MyIssue;
  onClick: () => void;
  showProject?: boolean;
}) {
  const priorityKey = (issue.priority || 'none') as Priority;
  const priorityConfig = PRIORITY_CONFIG[priorityKey] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = priorityConfig.icon;
  const issueKey = `${issue.project.prefix}-${issue.sequenceId}`;
  const category = issue.status?.category as StatusCategory | undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group flex h-[44px] w-full cursor-pointer select-none items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 text-left text-[13px] text-[color:var(--fg-1)] transition-colors last:border-b-0 hover:bg-[color:var(--bg-2)]"
    >
      {/* Priority */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <PriorityIcon className="h-[14px] w-[14px]" />
      </span>

      {/* Issue key */}
      <span className="w-[72px] shrink-0 font-mono text-[11.5px] text-[color:var(--fg-4)]">
        {issueKey}
      </span>

      {/* Status */}
      <span className="flex shrink-0 items-center">
        <CategoryGlyph category={category} color={issue.status?.color} size={13} />
      </span>

      {/* Title */}
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>

      {/* Project badge (hidden when already grouped by project) */}
      {showProject && (
        <span className="shrink-0 truncate font-mono text-[11px] text-[color:var(--fg-4)]">
          {issue.project.name}
        </span>
      )}
    </div>
  );
}
