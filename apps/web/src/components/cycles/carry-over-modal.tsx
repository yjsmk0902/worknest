import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CycleOutput, IssueOutput, IssueStatusOutput } from '@worknest/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  toast,
} from '@worknest/ui';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../lib/api-client';

// ── Types ───────────────────────────────────────────────────────────────

interface CarryOverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  cycleId: string;
  issues: IssueOutput[];
  statuses: IssueStatusOutput[];
  projectPrefix?: string;
}

// ── Component ───────────────────────────────────────────────────────────

export function CarryOverModal({
  open,
  onOpenChange,
  projectId,
  cycleId,
  issues,
  statuses,
  projectPrefix = '...',
}: CarryOverModalProps) {
  const queryClient = useQueryClient();
  const [targetCycleId, setTargetCycleId] = useState<string>('');

  // Incomplete issues (status category != completed/cancelled)
  const incompleteIssues = useMemo(() => {
    return issues.filter((issue) => {
      const status = statuses.find((s) => s.id === issue.statusId);
      return status && status.category !== 'completed' && status.category !== 'cancelled';
    });
  }, [issues, statuses]);

  // Fetch other cycles (draft/active) for target selection
  const cyclesQuery = useQuery<CycleOutput[]>({
    queryKey: ['projects', projectId, 'cycles', 'for-carryover'],
    queryFn: async () => {
      const res = await apiClient.getList<CycleOutput>(`/projects/${projectId}/cycles`);
      return res.data.filter(
        (c) => c.id !== cycleId && (c.status === 'draft' || c.status === 'active'),
      );
    },
    staleTime: 30 * 1000,
    enabled: open,
  });

  const availableCycles = cyclesQuery.data ?? [];

  // Set default target when cycles load
  useEffect(() => {
    if (availableCycles.length > 0 && !targetCycleId) {
      setTargetCycleId(availableCycles[0].id);
    }
  }, [availableCycles, targetCycleId]);

  // Complete cycle mutation
  const completeMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/cycles/${cycleId}/complete`, {
        targetCycleId: targetCycleId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', cycleId] });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'cycles'],
      });
      toast('사이클이 완료되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast('사이클 완료에 실패했습니다.');
    },
  });

  function handleComplete() {
    completeMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[560px]">
        <DialogHeader>
          <DialogTitle>사이클 완료</DialogTitle>
          <DialogDescription>
            미완료 이슈가 {incompleteIssues.length}개 있습니다. 이 이슈들을 어떻게 처리하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Incomplete issues list */}
        <div className="max-h-[240px] overflow-y-auto rounded-md border border-border">
          {incompleteIssues.map((issue) => {
            const status = statuses.find((s) => s.id === issue.statusId);
            return (
              <div
                key={issue.id}
                className="flex h-9 items-center gap-2 border-b border-border/50 px-3 last:border-b-0"
              >
                {/* Priority dot */}
                <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />

                {/* Issue key */}
                <span className="shrink-0 text-xs text-muted-foreground font-mono">
                  {projectPrefix}-{issue.sequenceId}
                </span>

                {/* Title */}
                <span className="flex-1 truncate text-sm">{issue.title}</span>

                {/* Status badge */}
                <span className="flex items-center gap-1 shrink-0">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: status?.color ?? '#94a3b8',
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{status?.name ?? ''}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Target cycle selector */}
        <div className="space-y-2">
          <label htmlFor="target-cycle" className="text-sm font-medium">
            이동 대상
          </label>
          <select
            id="target-cycle"
            value={targetCycleId}
            onChange={(e) => setTargetCycleId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">사이클에서 제거 (백로그)</option>
            {availableCycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status === 'active' ? 'Active' : 'Draft'})
              </option>
            ))}
          </select>
        </div>

        <Separator />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={completeMutation.isPending}
          >
            취소
          </Button>
          <Button onClick={handleComplete} disabled={completeMutation.isPending}>
            {completeMutation.isPending ? '처리 중...' : '사이클 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
