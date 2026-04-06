import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button, Skeleton } from '@worknest/ui';
import { apiClient, type ListResponse } from '../../../../../../../lib/api-client';
import { useWorkspaceContext } from '../../../../../../../contexts/workspace-context';
import { AppHeader } from '../../../../../../../components/layout/app-header';
import {
  CycleList,
  CycleEmptyState,
} from '../../../../../../../components/cycles/cycle-list';
import { CycleFormModal } from '../../../../../../../components/cycles/cycle-form-modal';
import type { CycleOutput, CycleProgressOutput } from '@worknest/shared';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/cycles/',
)({
  component: CycleListPage,
});

// ── Types ──────────────────────────────────────────────────────────────

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

// ── Main Component ─────────────────────────────────────────────────────

function CycleListPage() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();

  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch project info
  const projectQuery = useQuery<ProjectOutput>({
    queryKey: ['projects', projectId],
    queryFn: () =>
      apiClient.get<ProjectOutput>(
        `/workspaces/${wsId}/projects/${projectId}`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch cycles
  const cyclesQuery = useQuery<ListResponse<CycleOutput>>({
    queryKey: ['projects', projectId, 'cycles'],
    queryFn: () =>
      apiClient.getList<CycleOutput>(`/projects/${projectId}/cycles`),
  });

  // Fetch progress for each cycle
  const cycles = cyclesQuery.data?.data ?? [];
  const progressQueries = useQuery<Record<string, CycleProgressOutput>>({
    queryKey: ['projects', projectId, 'cycles', 'progress-all'],
    queryFn: async () => {
      if (cycles.length === 0) return {};
      const results = await Promise.all(
        cycles.map(async (c) => {
          try {
            const progress = await apiClient.get<CycleProgressOutput>(
              `/cycles/${c.id}/progress`,
            );
            return [c.id, progress] as const;
          } catch {
            return [c.id, { total: 0, completed: 0, byCategory: {} }] as const;
          }
        }),
      );
      return Object.fromEntries(results);
    },
    enabled: cycles.length > 0,
  });

  const progressMap = progressQueries.data ?? {};
  const project = projectQuery.data;

  // Sort: Active > Draft > Completed, then by startDate
  const sortedCycles = useMemo(() => {
    const statusOrder: Record<string, number> = {
      active: 0,
      draft: 1,
      completed: 2,
    };
    return [...cycles].sort((a, b) => {
      const oa = statusOrder[a.status] ?? 1;
      const ob = statusOrder[b.status] ?? 1;
      if (oa !== ob) return oa - ob;
      // Within same status, sort by startDate ascending
      if (a.startDate && b.startDate) {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      return 0;
    });
  }, [cycles]);

  // Loading state
  if (projectQuery.isLoading || cyclesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader
          title=""
          actions={<Skeleton className="h-9 w-32" />}
        />
        <div className="flex-1 p-6">
          <CycleListSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (projectQuery.isError || cyclesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="Cycles" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              사이클을 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                projectQuery.refetch();
                cyclesQuery.refetch();
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
        title="사이클"
        breadcrumbs={[{ label: project?.name ?? '' }]}
        actions={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>사이클 생성</span>
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {sortedCycles.length === 0 ? (
          <CycleEmptyState
            onCreateClick={() => setCreateModalOpen(true)}
          />
        ) : (
          <CycleList
            cycles={sortedCycles}
            progressMap={progressMap}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
            projectId={projectId}
          />
        )}
      </div>

      {/* Create modal */}
      <CycleFormModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
      />
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────

function CycleListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
