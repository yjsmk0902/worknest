import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button, Skeleton } from '@worknest/ui';
import { z } from 'zod';
import type { IssueOutput, IssueStatusOutput } from '@worknest/shared';
import { apiClient, type ListResponse } from '../../../../../../../lib/api-client';
import { useWorkspaceContext } from '../../../../../../../contexts/workspace-context';
import { AppHeader } from '../../../../../../../components/layout/app-header';
import { KanbanBoard } from '../../../../../../../components/issues/board-view/kanban-board';
import { IssueDetailPanel } from '../../../../../../../components/issues/issue-detail/issue-detail-panel';
import { QuickAdd } from '../../../../../../../components/issues/quick-add';
import { ViewToolbar } from '../../../../../../../components/issues/view-toolbar';
import { FilterBar } from '../../../../../../../components/issues/filter-builder/filter-bar';
import { useIssueFilters } from '../../../../../../../components/issues/filter-builder/use-issue-filters';
import { useHotkeyStore } from '../../../../../../../stores/hotkey-store';
import { useHotkey } from '../../../../../../../hooks/use-hotkey';

// ── Search param validation ─────────────────────────────────────────────

const boardSearchSchema = z.object({
  statusId: z.string().optional().catch(undefined),
  statusIdNot: z.string().optional().catch(undefined),
  typeId: z.string().optional().catch(undefined),
  typeIdNot: z.string().optional().catch(undefined),
  priority: z.string().optional().catch(undefined),
  priorityNot: z.string().optional().catch(undefined),
  assigneeId: z.string().optional().catch(undefined),
  assigneeIdNot: z.string().optional().catch(undefined),
  assigneeEmpty: z.coerce.boolean().optional().catch(undefined),
  labelId: z.string().optional().catch(undefined),
  labelIdNot: z.string().optional().catch(undefined),
  dueBefore: z.string().optional().catch(undefined),
  dueAfter: z.string().optional().catch(undefined),
  dueEmpty: z.coerce.boolean().optional().catch(undefined),
  title: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  order: z.string().optional().catch(undefined),
});

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/board/',
)({
  component: BoardPage,
  validateSearch: (search) => boardSearchSchema.parse(search),
});

// ── Types ─────────────────────────────────────────────────────────────

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

interface StatsResponse {
  byStatus: Record<string, number>;
  total: number;
}

// ── Main Component ────────────────────────────────────────────────────

function BoardPage() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const { apiParams } = useIssueFilters();

  // Set active context for hotkey system
  const setActiveContext = useHotkeyStore((s) => s.setActiveContext);
  useEffect(() => {
    setActiveContext('board');
    return () => setActiveContext('global');
  }, [setActiveContext]);

  // Keyboard shortcuts
  useHotkey(
    'c',
    () => {
      setShowQuickAdd(true);
    },
    { context: 'board' },
  );

  useHotkey(
    'escape',
    () => {
      if (selectedIssueId) {
        setSelectedIssueId(null);
      }
    },
    { context: 'board' },
  );

  // Fetch project info
  const projectQuery = useQuery<ProjectOutput>({
    queryKey: ['projects', projectId],
    queryFn: () =>
      apiClient.get<ProjectOutput>(
        `/workspaces/${wsId}/projects/${projectId}`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch statuses
  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () =>
      apiClient.get<IssueStatusOutput[]>(
        `/projects/${projectId}/statuses`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch issues with active filters applied
  const issuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'issues', apiParams],
    queryFn: () =>
      apiClient.getList<IssueOutput>(
        `/projects/${projectId}/issues`,
        { ...apiParams, limit: '100' },
      ),
  });

  // Fetch stats for column counts (with active filters)
  const statsQuery = useQuery<StatsResponse>({
    queryKey: ['projects', projectId, 'issues', 'stats', apiParams],
    queryFn: () =>
      apiClient.get<StatsResponse>(
        `/projects/${projectId}/issues/stats`,
        apiParams,
      ),
    staleTime: 30 * 1000,
  });

  const project = projectQuery.data;
  const statuses = statusesQuery.data ?? [];
  const issues = issuesQuery.data?.data ?? [];
  const stats = statsQuery.data?.byStatus ?? {};
  const projectPrefix = project?.prefix ?? '...';

  // Loading state
  const isLoading =
    projectQuery.isLoading ||
    statusesQuery.isLoading ||
    issuesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader
          title=""
          actions={<Skeleton className="h-9 w-24" />}
        />
        <div className="flex-1 p-4">
          <BoardSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  const isError =
    projectQuery.isError ||
    statusesQuery.isError ||
    issuesQuery.isError;

  if (isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="Board" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              보드를 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                projectQuery.refetch();
                statusesQuery.refetch();
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
        title={`${projectPrefix} Board`}
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

      {/* View toolbar */}
      <ViewToolbar totalCount={statsQuery.data?.total ?? issues.length} />

      {/* Filter bar */}
      <FilterBar />

      {/* Quick Add overlay */}
      {showQuickAdd && (
        <div className="mx-4 mt-2">
          <QuickAdd
            projectId={projectId}
            onClose={() => setShowQuickAdd(false)}
          />
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden pt-2">
        <KanbanBoard
          statuses={statuses}
          issues={issues}
          stats={stats}
          projectId={projectId}
          projectPrefix={projectPrefix}
          onCardClick={(issueId) => setSelectedIssueId(issueId)}
          onCreateClick={() => setShowQuickAdd(true)}
        />
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

// ── Loading Skeleton ──────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="flex gap-3 h-full">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col min-w-[280px] max-w-[320px] w-[280px] rounded-lg bg-muted/30"
        >
          {/* Column header skeleton */}
          <div className="flex h-10 items-center gap-2 px-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <div className="ml-auto">
              <Skeleton className="h-3 w-4" />
            </div>
          </div>

          {/* Cards skeleton */}
          <div className="flex-1 px-2 py-1 space-y-2">
            {Array.from({ length: Math.max(1, 3 - i) }).map((_, j) => (
              <div
                key={j}
                className="rounded-md border border-border bg-card p-3 space-y-2"
              >
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-5 rounded-full ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
