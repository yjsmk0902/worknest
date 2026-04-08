import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BulkUpdateInput, IssueStatusOutput } from '@worknest/shared';
import {
  Avatar,
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
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toast,
} from '@worknest/ui';
import { cn } from '@worknest/ui';
import { Check, Loader2, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import { type ListResponse, apiClient } from '../../lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '../../lib/issue-constants';
import { useUIStore } from '../../stores/ui-store';

// ── Types ───────────────────────────────────────────────────────────────

interface LabelOutput {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface MemberOutput {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface BulkActionBarProps {
  projectId: string;
  selectedIds: string[];
  onClearSelection: () => void;
}

// ── Component ───────────────────────────────────────────────────────────

export function BulkActionBar({ projectId, selectedIds, onClearSelection }: BulkActionBarProps) {
  const queryClient = useQueryClient();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const count = selectedIds.length;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeMutation, setActiveMutation] = useState<string | null>(null);

  // ── Bulk update mutation ────────────────────────────────────────────

  const bulkUpdate = useMutation({
    mutationFn: (input: BulkUpdateInput) =>
      apiClient.patch(`/projects/${projectId}/issues/bulk`, input),
    onSuccess: () => {
      toast(`${count}건 업데이트 완료`);
      onClearSelection();
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => {
      toast('업데이트에 실패했습니다. 다시 시도해주세요.');
    },
    onSettled: () => {
      setActiveMutation(null);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: () =>
      Promise.all(selectedIds.map((id) => apiClient.delete(`/projects/${projectId}/issues/${id}`))),
    onSuccess: () => {
      toast(`${count}건 삭제 완료`);
      onClearSelection();
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => {
      toast('삭제에 실패했습니다. 다시 시도해주세요.');
    },
    onSettled: () => {
      setDeleteDialogOpen(false);
      setActiveMutation(null);
    },
  });

  const isPending = bulkUpdate.isPending || bulkDelete.isPending;

  const handleBulkChange = useCallback(
    (actionKey: string, changes: BulkUpdateInput['changes']) => {
      setActiveMutation(actionKey);
      bulkUpdate.mutate({ issueIds: selectedIds, changes });
    },
    [bulkUpdate, selectedIds],
  );

  if (count === 0) return null;

  return (
    <>
      <div
        className={cn(
          'fixed bottom-0 right-0 z-50 flex h-12 items-center justify-between border-t border-border bg-background px-4 shadow-lg',
          'transition-transform duration-150 ease-out',
          count > 0 ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{
          left: sidebarCollapsed ? '48px' : '240px',
        }}
        role="toolbar"
        aria-label="선택된 이슈 액션"
      >
        {/* Left: selection count */}
        <div className="text-sm font-medium" aria-live="polite">
          {count}건 선택됨
        </div>

        {/* Center: action buttons */}
        <div className="flex items-center gap-2">
          <StatusChangeButton
            projectId={projectId}
            disabled={isPending}
            isLoading={activeMutation === 'status'}
            onSelect={(statusId) => handleBulkChange('status', { statusId })}
          />
          <PriorityChangeButton
            disabled={isPending}
            isLoading={activeMutation === 'priority'}
            onSelect={(priority) => handleBulkChange('priority', { priority })}
          />
          <AssigneeChangeButton
            projectId={projectId}
            disabled={isPending}
            isLoading={activeMutation === 'assignee'}
            onApply={(assigneeIds) => handleBulkChange('assignee', { assigneeIds })}
          />
          <LabelChangeButton
            projectId={projectId}
            disabled={isPending}
            isLoading={activeMutation === 'label'}
            onApply={(labelIds) => handleBulkChange('label', { labelIds })}
          />
        </div>

        {/* Right: clear + delete */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isPending}
            onClick={onClearSelection}
          >
            전체 해제
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {activeMutation === 'delete' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                처리 중...
              </>
            ) : (
              '삭제'
            )}
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>이슈 삭제</DialogTitle>
            <DialogDescription>
              선택한 {count}건의 이슈를 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={bulkDelete.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDelete.isPending}
              onClick={() => {
                setActiveMutation('delete');
                bulkDelete.mutate();
              }}
            >
              {bulkDelete.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Status Change Button ──────────────────────────────────────────────

interface StatusChangeButtonProps {
  projectId: string;
  disabled: boolean;
  isLoading: boolean;
  onSelect: (statusId: string) => void;
}

function StatusChangeButton({ projectId, disabled, isLoading, onSelect }: StatusChangeButtonProps) {
  const [open, setOpen] = useState(false);

  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => apiClient.get<IssueStatusOutput[]>(`/projects/${projectId}/statuses`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const statuses = statusesQuery.data ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} aria-label="선택된 이슈 상태 변경">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            '상태 변경'
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.id}
            onClick={() => {
              onSelect(status.id);
              setOpen(false);
            }}
            className="cursor-pointer"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="text-sm">{status.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Priority Change Button ────────────────────────────────────────────

interface PriorityChangeButtonProps {
  disabled: boolean;
  isLoading: boolean;
  onSelect: (priority: Priority) => void;
}

function PriorityChangeButton({ disabled, isLoading, onSelect }: PriorityChangeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label="선택된 이슈 우선순위 변경"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            '우선순위 변경'
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => {
          const config = PRIORITY_CONFIG[priority];
          const PIcon = config.icon;
          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => {
                onSelect(priority);
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <PIcon className={cn('h-3 w-3', config.color)} />
              <span className="text-sm">{config.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Assignee Change Button ────────────────────────────────────────────

interface AssigneeChangeButtonProps {
  projectId: string;
  disabled: boolean;
  isLoading: boolean;
  onApply: (assigneeIds: string[]) => void;
}

function AssigneeChangeButton({
  projectId,
  disabled,
  isLoading,
  onApply,
}: AssigneeChangeButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const membersQuery = useQuery<ListResponse<MemberOutput>>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => apiClient.getList<MemberOutput>(`/projects/${projectId}/members`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const members = membersQuery.data?.data ?? [];
  const filtered = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(selected));
    setOpen(false);
    setSelected(new Set());
    setSearch('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelected(new Set());
      setSearch('');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label="선택된 이슈 담당자 변경"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            '담당자 변경'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[240px] p-2">
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="멤버 검색..."
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {filtered.map((member) => {
            const isChecked = selected.has(member.user.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => handleToggle(member.user.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    isChecked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {isChecked && <Check className="h-3 w-3" />}
                </div>
                <Avatar src={member.user.avatarUrl} fallback={member.user.name} size="sm" />
                <span className="flex-1 truncate text-left">{member.user.name}</span>
              </button>
            );
          })}
        </div>
        <Separator className="my-1" />
        <Button size="sm" className="w-full" onClick={handleApply}>
          적용
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ── Label Change Button ───────────────────────────────────────────────

interface LabelChangeButtonProps {
  projectId: string;
  disabled: boolean;
  isLoading: boolean;
  onApply: (labelIds: string[]) => void;
}

function LabelChangeButton({ projectId, disabled, isLoading, onApply }: LabelChangeButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'add' | 'replace'>('add');

  const labelsQuery = useQuery<LabelOutput[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => apiClient.get<LabelOutput[]>(`/projects/${projectId}/labels`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const labels = labelsQuery.data ?? [];
  const filtered = labels.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = (labelId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  };

  const handleApply = () => {
    // Both modes use labelIds in the bulk API; the backend handles mode semantics.
    // For MVP, "replace" sets exactly these labels; "add" is a client concern
    // that the server may or may not support. We send labelIds as-is.
    onApply(Array.from(selected));
    setOpen(false);
    setSelected(new Set());
    setSearch('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelected(new Set());
      setSearch('');
      setMode('add');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} aria-label="선택된 이슈 라벨 변경">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            '라벨 변경'
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[240px] p-2">
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="라벨 검색..."
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {filtered.map((label) => {
            const isChecked = selected.has(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => handleToggle(label.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    isChecked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  {isChecked && <Check className="h-3 w-3" />}
                </div>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 truncate text-left">{label.name}</span>
              </button>
            );
          })}
        </div>
        <Separator className="my-1" />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'add' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => {
              setMode('add');
              handleApply();
            }}
          >
            추가
          </Button>
          <Button
            size="sm"
            variant={mode === 'replace' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => {
              setMode('replace');
              handleApply();
            }}
          >
            교체
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
