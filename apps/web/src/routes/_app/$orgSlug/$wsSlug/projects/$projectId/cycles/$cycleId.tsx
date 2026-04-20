import { AddIssuesPopover } from '@/components/cycles/add-issues-popover';
import { CarryOverModal } from '@/components/cycles/carry-over-modal';
import { CycleFormModal } from '@/components/cycles/cycle-form-modal';
import {
  CycleProgressBar,
  CycleStatusBadge,
  formatCycleDateRange,
} from '@/components/cycles/cycle-list';
import { AppHeader } from '@/components/layout/app-header';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { type ListResponse, apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type {
  CycleOutput,
  CycleProgressOutput,
  IssueOutput,
  IssueStatusOutput,
} from '@worknest/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  toast,
} from '@worknest/ui';
import { AlertTriangle, Edit, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/projects/$projectId/cycles/$cycleId')({
  component: CycleDetailPage,
});

// ── Types ──────────────────────────────────────────────────────────────

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

// ── Main Component ─────────────────────────────────────────────────────

function CycleDetailPage() {
  const { orgSlug, wsSlug, projectId, cycleId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [carryOverOpen, setCarryOverOpen] = useState(false);

  // Fetch project
  const projectQuery = useQuery<ProjectOutput>({
    queryKey: ['projects', projectId],
    queryFn: () => apiClient.get<ProjectOutput>(`/workspaces/${wsId}/projects/${projectId}`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch cycle detail
  const cycleQuery = useQuery<CycleOutput>({
    queryKey: ['cycles', cycleId],
    queryFn: () => apiClient.get<CycleOutput>(`/cycles/${cycleId}`),
  });

  // Fetch progress
  const progressQuery = useQuery<CycleProgressOutput>({
    queryKey: ['cycles', cycleId, 'progress'],
    queryFn: () => apiClient.get<CycleProgressOutput>(`/cycles/${cycleId}/progress`),
  });

  // Fetch cycle issues
  const cycleIssuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['cycles', cycleId, 'issues'],
    queryFn: () => apiClient.getList<IssueOutput>(`/cycles/${cycleId}/issues`),
  });

  // Fetch statuses for issue display
  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => apiClient.get<IssueStatusOutput[]>(`/projects/${projectId}/statuses`),
    staleTime: 5 * 60 * 1000,
  });

  const cycle = cycleQuery.data;
  const progress = progressQuery.data;
  const issues = cycleIssuesQuery.data?.data ?? [];
  const statuses = statusesQuery.data ?? [];
  const project = projectQuery.data;
  const projectPrefix = project?.prefix ?? '...';

  const existingIssueIds = useMemo(() => new Set(issues.map((i) => i.id)), [issues]);

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: () => apiClient.post<CycleOutput>(`/cycles/${cycleId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', cycleId] });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'cycles'],
      });
      toast('사이클이 활성화되었습니다.');
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes('active cycle already exists')) {
        toast('이미 활성화된 사이클이 있습니다. 기존 사이클을 완료한 후 다시 시도해주세요.');
      } else {
        toast(err instanceof Error ? err.message : '사이클 활성화에 실패했습니다.');
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/cycles/${cycleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'cycles'],
      });
      toast('사이클이 삭제되었습니다.');
      navigate({
        to: '/$orgSlug/$wsSlug/projects/$projectId/cycles',
        params: { orgSlug, wsSlug, projectId },
      });
    },
    onError: (err) => toast(err instanceof Error ? err.message : '사이클 삭제에 실패했습니다.'),
  });

  // Remove issue from cycle
  const removeIssueMutation = useMutation({
    mutationFn: (issueId: string) => apiClient.delete(`/cycles/${cycleId}/issues/${issueId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['cycles', cycleId, 'issues'],
      });
      queryClient.invalidateQueries({
        queryKey: ['cycles', cycleId, 'progress'],
      });
      toast('이슈가 사이클에서 제거되었습니다.');
    },
    onError: () => toast('이슈 제거에 실패했습니다.'),
  });

  const handleComplete = useCallback(() => {
    // Check for incomplete issues
    if (!statuses.length) return;

    const incompleteIssues = issues.filter((issue) => {
      const status = statuses.find((s) => s.id === issue.statusId);
      return status && status.category !== 'completed' && status.category !== 'cancelled';
    });

    if (incompleteIssues.length > 0) {
      setCarryOverOpen(true);
    } else {
      // No incomplete issues, complete directly
      apiClient
        .post(`/cycles/${cycleId}/complete`, {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['cycles', cycleId] });
          queryClient.invalidateQueries({
            queryKey: ['projects', projectId, 'cycles'],
          });
          toast('사이클이 완료되었습니다.');
        })
        .catch((err: unknown) =>
          toast(err instanceof Error ? err.message : '사이클 완료에 실패했습니다.'),
        );
    }
  }, [issues, statuses, cycleId, projectId, queryClient]);

  // Loading state
  const isLoading = projectQuery.isLoading || cycleQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="" actions={<Skeleton className="h-9 w-32" />} />
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  // Error state
  if (cycleQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="Cycle" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">사이클을 불러올 수 없습니다.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => cycleQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!cycle) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <AppHeader
        title={cycle.name}
        breadcrumbs={[
          { label: project?.name ?? '' },
          {
            label: '사이클',
            href: `/${orgSlug}/${wsSlug}/projects/${projectId}/cycles`,
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <AddIssuesPopover
              projectId={projectId}
              cycleId={cycleId}
              existingIssueIds={existingIssueIds}
              projectPrefix={projectPrefix}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  <span>이슈 추가</span>
                </Button>
              }
            />

            {cycle.status === 'draft' && (
              <Button
                size="sm"
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
              >
                활성화
              </Button>
            )}

            {cycle.status === 'active' && (
              <Button size="sm" onClick={handleComplete}>
                사이클 완료
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  편집
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Cycle info header */}
      <div className="border-b border-border px-6 py-4 space-y-3">
        {/* Status + Date row */}
        <div className="flex items-center gap-3">
          <CycleStatusBadge status={cycle.status} />
          <span className="text-sm text-muted-foreground">
            {formatCycleDateRange(cycle.startDate, cycle.endDate)}
          </span>
        </div>

        {/* Description */}
        {cycle.description && <p className="text-sm text-muted-foreground">{cycle.description}</p>}

        {/* Progress bar */}
        <CycleProgressBar progress={progress} status={cycle.status} height="h-2.5" />
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto p-4">
        {cycleIssuesQuery.isLoading ? (
          <IssueListSkeleton />
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-medium">이슈가 없습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              이슈를 추가하여 사이클을 시작하세요
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            {/* Table header */}
            <div className="flex h-8 items-center border-b border-border bg-muted/50 px-3">
              <span className="w-[80px] text-xs font-medium text-muted-foreground">키</span>
              <span className="flex-1 text-xs font-medium text-muted-foreground">제목</span>
              <span className="w-[120px] text-xs font-medium text-muted-foreground">상태</span>
              <span className="w-[80px] text-xs font-medium text-muted-foreground">우선순위</span>
              <span className="w-[60px]" />
            </div>

            {/* Issue rows */}
            {issues.map((issue) => {
              const status = statuses.find((s) => s.id === issue.statusId);
              return (
                <div
                  key={issue.id}
                  className="flex h-10 items-center border-b border-border/50 px-3 last:border-b-0 hover:bg-accent/50 cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: '/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId',
                      params: { orgSlug, wsSlug, projectId, issueId: issue.id },
                    })
                  }
                >
                  {/* Issue key */}
                  <span className="w-[80px] text-xs text-muted-foreground font-mono">
                    {projectPrefix}-{issue.sequenceId}
                  </span>

                  {/* Title */}
                  <span className="flex-1 truncate text-sm">{issue.title}</span>

                  {/* Status */}
                  <span className="w-[120px] flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: status?.color ?? '#94a3b8' }}
                    />
                    <span className="text-xs truncate">{status?.name ?? ''}</span>
                  </span>

                  {/* Priority */}
                  <span className="w-[80px] text-xs capitalize text-muted-foreground">
                    {issue.priority ?? '-'}
                  </span>

                  {/* Remove button */}
                  <span className="w-[60px] flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeIssueMutation.mutate(issue.id);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="사이클에서 제거"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <CycleFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        projectId={projectId}
        cycle={cycle}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[400px]">
          <DialogHeader>
            <DialogTitle>사이클 삭제</DialogTitle>
            <DialogDescription>
              "{cycle.name}" 사이클을 삭제하시겠습니까?
              {cycle.status === 'completed' && ' 완료된 사이클의 기록이 영구적으로 삭제됩니다.'}{' '}
              이슈는 삭제되지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate();
                setDeleteDialogOpen(false);
              }}
              disabled={deleteMutation.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Carry over modal */}
      <CarryOverModal
        open={carryOverOpen}
        onOpenChange={setCarryOverOpen}
        projectId={projectId}
        cycleId={cycleId}
        issues={issues}
        statuses={statuses}
        projectPrefix={projectPrefix}
      />
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────

function IssueListSkeleton() {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex h-8 items-center gap-2 border-b border-border bg-muted/50 px-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex h-10 items-center gap-2 border-b border-border/50 px-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-[70px]" />
          <div className="flex flex-1">
            <Skeleton className="h-4" style={{ width: `${40 + Math.random() * 40}%` }} />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
