import { useState, useCallback, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronDown,
  CircleUser,
  AlertTriangle,
} from 'lucide-react';
import { Button, Skeleton } from '@worknest/ui';
import type { StatusCategory } from '@worknest/shared';
import { apiClient } from '../../../../../lib/api-client';
import { useWorkspaceContext } from '../../../../../contexts/workspace-context';
import { PRIORITY_CONFIG, type Priority } from '../../../../../lib/issue-constants';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/my/issues',
)({
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

// ── Status category display config ─────────────────────────────────────

const CATEGORY_CONFIG: Record<
  StatusCategory,
  { label: string; color: string; defaultOpen: boolean }
> = {
  started: { label: 'In Progress', color: 'bg-yellow-500', defaultOpen: true },
  unstarted: { label: 'Todo', color: 'bg-blue-500', defaultOpen: true },
  backlog: { label: 'Backlog', color: 'bg-gray-400', defaultOpen: false },
  completed: { label: 'Done', color: 'bg-green-500', defaultOpen: false },
  cancelled: { label: 'Cancelled', color: 'bg-red-400', defaultOpen: false },
};

// Category display order
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

  // Default accordion state per category
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const state: Record<string, boolean> = {};
      for (const cat of CATEGORY_ORDER) {
        state[cat] = CATEGORY_CONFIG[cat].defaultOpen;
      }
      return state;
    },
  );

  // Fetch my issues
  const myIssuesQuery = useQuery<GroupedIssues>({
    queryKey: ['workspaces', wsId, 'my-issues'],
    queryFn: () =>
      apiClient.get<GroupedIssues>(`/workspaces/${wsId}/my-issues`),
    staleTime: 30 * 1000,
  });

  // Toggle accordion section
  const toggleSection = useCallback((category: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  // Navigate to issue detail
  const handleIssueClick = useCallback(
    (issue: MyIssue) => {
      navigate({
        to: '/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId',
        params: {
          orgSlug,
          wsSlug,
          projectId: issue.projectId,
          issueId: issue.id,
        },
      });
    },
    [navigate, orgSlug, wsSlug],
  );

  // Total issue count
  const totalIssues = useMemo(() => {
    if (!myIssuesQuery.data) return 0;
    return CATEGORY_ORDER.reduce(
      (sum, cat) => sum + (myIssuesQuery.data[cat]?.length ?? 0),
      0,
    );
  }, [myIssuesQuery.data]);

  // Loading state
  if (myIssuesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">내 이슈</h1>
        </div>
        <div
          className="flex-1 space-y-1 px-2"
          aria-busy="true"
          aria-label="이슈 로딩 중"
        >
          {/* Accordion header skeletons */}
          {[1, 2].map((i) => (
            <div key={`header-${i}`}>
              <Skeleton className="mx-6 mb-1 h-10 rounded-md" />
              {[1, 2, 3].map((j) => (
                <Skeleton
                  key={`row-${i}-${j}`}
                  className="mx-6 h-10"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (myIssuesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">내 이슈</h1>
        </div>
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
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">내 이슈</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
          <CircleUser className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">할당된 이슈가 없습니다</p>
          <p className="text-sm text-muted-foreground">
            이슈에 할당되면 여기에 표시됩니다
          </p>
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

  const grouped = myIssuesQuery.data!;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-6 py-4">
        <h1 className="text-2xl font-semibold">내 이슈</h1>
      </div>

      {/* Accordion sections */}
      <div className="flex-1 overflow-y-auto pb-4">
        {CATEGORY_ORDER.map((category) => {
          const issues = grouped[category] ?? [];
          if (issues.length === 0 && !CATEGORY_CONFIG[category].defaultOpen) {
            return null;
          }

          const config = CATEGORY_CONFIG[category];
          const isOpen = openSections[category];

          return (
            <div
              key={category}
              role="region"
              aria-label={`${config.label} 이슈`}
            >
              {/* Accordion header */}
              <button
                type="button"
                onClick={() => toggleSection(category)}
                className="mx-6 mb-1 flex h-10 w-[calc(100%-3rem)] cursor-pointer items-center gap-2 rounded-md bg-muted/30 px-4 hover:bg-muted/50"
                aria-expanded={isOpen}
                aria-controls={`section-${category}`}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-150" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-150" />
                )}
                <span
                  className={`h-2.5 w-2.5 rounded-full ${config.color}`}
                />
                <span className="text-sm font-medium text-foreground">
                  {config.label}
                </span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {issues.length}
                </span>
              </button>

              {/* Issue rows */}
              {isOpen && (
                <div id={`section-${category}`}>
                  {issues.map((issue) => {
                    const priorityKey = (issue.priority || 'none') as Priority;
                    const priorityConfig = PRIORITY_CONFIG[priorityKey] ?? PRIORITY_CONFIG.none;
                    const PriorityIcon = priorityConfig.icon;
                    const issueKey = `${issue.project.prefix}-${issue.sequenceId}`;

                    return (
                      <button
                        key={issue.id}
                        type="button"
                        className="flex h-10 w-full cursor-pointer items-center gap-2 border-b border-border/50 px-6 transition-colors hover:bg-accent/50"
                        onClick={() => handleIssueClick(issue)}
                      >
                        {/* Project prefix */}
                        <span className="w-10 shrink-0 text-left font-mono text-xs text-muted-foreground">
                          {issue.project.prefix}
                        </span>

                        {/* Issue key */}
                        <span className="w-20 shrink-0 text-left font-mono text-xs text-muted-foreground">
                          {issueKey}
                        </span>

                        {/* Title */}
                        <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground">
                          {issue.title}
                        </span>

                        {/* Status badge */}
                        {issue.status && (
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: issue.status.color }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {issue.status.name}
                            </span>
                          </span>
                        )}

                        {/* Priority icon */}
                        <PriorityIcon
                          className={`h-4 w-4 shrink-0 ${priorityConfig.color}`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
