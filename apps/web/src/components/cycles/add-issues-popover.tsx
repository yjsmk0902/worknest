import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CycleIssueOutput, IssueOutput } from '@worknest/shared';
import { Button, Popover, PopoverContent, PopoverTrigger, Separator, toast } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type ListResponse, apiClient } from '../../lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '../../lib/issue-constants';

// ── Types ───────────────────────────────────────────────────────────────

interface AddIssuesPopoverProps {
  projectId: string;
  cycleId: string;
  /** Issue IDs already in the cycle */
  existingIssueIds: Set<string>;
  trigger: React.ReactNode;
  projectPrefix?: string;
}

// ── Component ───────────────────────────────────────────────────────────

export function AddIssuesPopover({
  projectId,
  cycleId,
  existingIssueIds,
  trigger,
  projectPrefix = '...',
}: AddIssuesPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch all project issues
  const issuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'issues', 'for-cycle-add'],
    queryFn: () =>
      apiClient.getList<IssueOutput>(`/projects/${projectId}/issues`, { limit: '100' }),
    staleTime: 30 * 1000,
    enabled: open,
  });

  // Filter out already-added issues and apply search
  const availableIssues = useMemo(() => {
    const all = issuesQuery.data?.data ?? [];
    return all.filter((issue) => {
      if (existingIssueIds.has(issue.id)) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const key = `${projectPrefix}-${issue.sequenceId}`.toLowerCase();
      return issue.title.toLowerCase().includes(q) || key.includes(q);
    });
  }, [issuesQuery.data, existingIssueIds, searchQuery, projectPrefix]);

  // Add issues mutation
  const addMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      const results = await Promise.allSettled(
        issueIds.map((issueId) =>
          apiClient.post<CycleIssueOutput>(`/cycles/${cycleId}/issues`, { issueId }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed}개 이슈 추가에 실패했습니다.`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['cycles', cycleId, 'issues'],
      });
      queryClient.invalidateQueries({
        queryKey: ['cycles', cycleId, 'progress'],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'cycles'],
      });
      toast(`${selectedIds.size}개 이슈가 추가되었습니다.`);
      setSelectedIds(new Set());
      setOpen(false);
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : '이슈 추가에 실패했습니다.');
    },
  });

  function toggleIssue(issueId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }

  function handleAdd() {
    if (selectedIds.size === 0) return;
    addMutation.mutate(Array.from(selectedIds));
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen) {
      setSearchQuery('');
      setSelectedIds(new Set());
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        {/* Header */}
        <div className="px-3 py-2 text-sm font-medium">이슈 추가</div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border border-border px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이슈 검색..."
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Issue list */}
        <div className="max-h-[320px] overflow-y-auto px-1">
          {issuesQuery.isLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">로딩 중...</div>
          )}

          {!issuesQuery.isLoading && availableIssues.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? '검색 결과가 없습니다' : '추가할 수 있는 이슈가 없습니다'}
            </div>
          )}

          {availableIssues.map((issue) => {
            const isSelected = selectedIds.has(issue.id);
            const priorityConfig = PRIORITY_CONFIG[(issue.priority as Priority) ?? 'none'];
            const PriorityIcon = priorityConfig?.icon;

            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => toggleIssue(issue.id)}
                className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent"
              >
                {/* Checkbox */}
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>

                {/* Priority icon */}
                {PriorityIcon && (
                  <PriorityIcon className={cn('h-3.5 w-3.5 shrink-0', priorityConfig?.color)} />
                )}

                {/* Issue key */}
                <span className="shrink-0 text-xs text-muted-foreground font-mono">
                  {projectPrefix}-{issue.sequenceId}
                </span>

                {/* Title */}
                <span className="flex-1 truncate text-left">{issue.title}</span>
              </button>
            );
          })}
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-muted-foreground">{selectedIds.size}개 선택됨</span>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || addMutation.isPending}
          >
            {addMutation.isPending ? '추가 중...' : '이슈 추가'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
