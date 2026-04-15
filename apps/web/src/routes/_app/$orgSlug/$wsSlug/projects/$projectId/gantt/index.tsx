import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button, Skeleton } from '@worknest/ui';
import { z } from 'zod';
import type { IssueOutput } from '@worknest/shared';
import { apiClient, type ListResponse } from '@/lib/api-client';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { AppHeader } from '@/components/layout/app-header';
import { GanttChart } from '@/components/issues/gantt-view/gantt-chart';
import { IssueDetailPanel } from '@/components/issues/issue-detail/issue-detail-panel';
import { QuickAdd } from '@/components/issues/quick-add';
import { ViewToolbar } from '@/components/issues/view-toolbar';
import { FilterBar } from '@/components/issues/filter-builder/filter-bar';
import { useIssueFilters } from '@/components/issues/filter-builder/use-issue-filters';
import { useHotkeyStore } from '@/stores/hotkey-store';
import { useHotkey } from '@/hooks/use-hotkey';

// ── Search param validation ─────────────────────────────────────────────

const ganttSearchSchema = z.object({
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
  cycleId: z.string().optional().catch(undefined),
  cycleIdNot: z.string().optional().catch(undefined),
  cycleEmpty: z.coerce.boolean().optional().catch(undefined),
  title: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  order: z.string().optional().catch(undefined),
});

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/gantt/',
)({
  component: GanttPage,
  validateSearch: (search) => ganttSearchSchema.parse(search),
});

// ── Types ─────────────────────────────────────────────────────────────

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

// ── Main Component ────────────────────────────────────────────────────

function GanttPage() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const { apiParams } = useIssueFilters();

  // Set active context for hotkey system
  const setActiveContext = useHotkeyStore((s) => s.setActiveContext);
  useEffect(() => {
    setActiveContext('gantt');
    return () => setActiveContext('global');
  }, [setActiveContext]);

  // Keyboard shortcuts
  useHotkey(
    'c',
    () => {
      setShowQuickAdd(true);
    },
    { context: 'gantt' },
  );

  useHotkey(
    'escape',
    () => {
      if (selectedIssueId) {
        setSelectedIssueId(null);
      }
    },
    { context: 'gantt' },
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

  // Fetch all issues (gantt needs all to show full timeline)
  const issuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'gantt-issues', apiParams],
    queryFn: () =>
      apiClient.getList<IssueOutput>(
        `/projects/${projectId}/issues`,
        { ...apiParams, limit: '200' },
      ),
  });

  const project = projectQuery.data;
  const issues = issuesQuery.data?.data ?? [];
  const projectPrefix = project?.prefix ?? '...';

  const isLoading = projectQuery.isLoading || issuesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader
          title=""
          actions={<Skeleton className="h-9 w-24" />}
        />
        <div className="flex-1 p-4">
          <GanttSkeleton />
        </div>
      </div>
    );
  }

  const isError = projectQuery.isError || issuesQuery.isError;

  if (isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="Gantt" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              간트 차트를 불러올 수 없습니다.
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
        title={`${projectPrefix} Gantt`}
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
      <ViewToolbar totalCount={issues.length} />

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

      {/* Gantt Chart */}
      <div className="flex-1 overflow-hidden">
        <GanttChart
          issues={issues}
          projectPrefix={projectPrefix}
          onIssueClick={(issueId) => setSelectedIssueId(issueId)}
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

function GanttSkeleton() {
  return (
    <div className="flex h-full gap-0">
      {/* Left panel skeleton */}
      <div className="w-[360px] shrink-0 border-r border-border">
        <div className="h-14 border-b border-border bg-muted/50 px-3 pt-8">
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-2 border-b border-border/50 px-3"
          >
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Right panel skeleton */}
      <div className="flex-1">
        <div className="h-14 border-b border-border bg-muted/50" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex h-10 items-center border-b border-border/30 px-4"
          >
            <Skeleton
              className="h-6 rounded-md"
              style={{
                width: `${80 + Math.random() * 200}px`,
                marginLeft: `${40 + i * 30}px`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
