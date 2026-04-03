import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import {
  Avatar,
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
import { apiClient, type ListResponse } from '../../../lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '../../../lib/issue-constants';
import type { IssueOutput, IssueStatusOutput } from '@worknest/shared';

// ── Types ───────────────────────────────────────────────────────────────

interface MemberOutput {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

// ── Optimistic update helper ────────────────────────────────────────────

function useInlineUpdate(projectId: string, issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch<IssueOutput>(
        `/projects/${projectId}/issues/${issueId}`,
        data,
      ),
    onMutate: async (newData) => {
      // Optimistically update the issue in the list cache
      const listKey = ['projects', projectId, 'issues'];
      await queryClient.cancelQueries({ queryKey: listKey });

      queryClient.setQueriesData<{
        pages: Array<{ data: IssueOutput[]; pagination: unknown }>;
        pageParams: unknown[];
      }>(
        { queryKey: listKey },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((issue) =>
                issue.id === issueId
                  ? { ...issue, ...newData }
                  : issue,
              ),
            })),
          };
        },
      );

      // Also update single issue cache if it exists
      const detailKey = ['projects', projectId, 'issues', issueId];
      queryClient.setQueryData<IssueOutput>(detailKey, (old) =>
        old ? { ...old, ...newData } : old,
      );
    },
    onError: () => {
      toast('변경에 실패했습니다.');
      // Refetch to restore correct state
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
  });
}

// ── StatusCell ──────────────────────────────────────────────────────────

interface StatusCellProps {
  issue: IssueOutput;
  projectId: string;
}

export function StatusCell({ issue, projectId }: StatusCellProps) {
  const [open, setOpen] = useState(false);
  const mutation = useInlineUpdate(projectId, issue.id);

  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () =>
      apiClient.get<IssueStatusOutput[]>(
        `/projects/${projectId}/statuses`,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const statuses = statusesQuery.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full items-center gap-1.5 rounded-sm px-1 text-xs hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          {issue.status ? (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: issue.status.color }}
              />
              <span className="truncate">{issue.status.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">--</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[200px] p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {statuses.map((status) => (
          <button
            key={status.id}
            type="button"
            onClick={() => {
              mutation.mutate({ statusId: status.id });
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="flex-1 text-left">{status.name}</span>
            {status.id === issue.statusId && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── PriorityCell ────────────────────────────────────────────────────────

interface PriorityCellProps {
  issue: IssueOutput;
  projectId: string;
}

export function PriorityCell({ issue, projectId }: PriorityCellProps) {
  const mutation = useInlineUpdate(projectId, issue.id);
  const current = (issue.priority as Priority) ?? 'none';
  const config = PRIORITY_CONFIG[current] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = config.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full items-center justify-center rounded-sm hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <PriorityIcon className={cn('h-4 w-4', config.color)} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => {
          const pConfig = PRIORITY_CONFIG[priority];
          const PIcon = pConfig.icon;
          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => mutation.mutate({ priority })}
              className="cursor-pointer"
            >
              <PIcon className={cn('h-4 w-4', pConfig.color)} />
              <span className="flex-1">{pConfig.label}</span>
              {priority === current && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── AssigneeCell ────────────────────────────────────────────────────────

interface AssigneeCellProps {
  issue: IssueOutput;
  projectId: string;
}

export function AssigneeCell({ issue, projectId }: AssigneeCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const membersQuery = useQuery<ListResponse<MemberOutput>>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () =>
      apiClient.getList<MemberOutput>(`/projects/${projectId}/members`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const addAssignee = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/projects/${projectId}/issues/${issue.id}/assignees`, {
        userId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => toast('담당자 추가에 실패했습니다.'),
  });

  const removeAssignee = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(
        `/projects/${projectId}/issues/${issue.id}/assignees/${userId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => toast('담당자 제거에 실패했습니다.'),
  });

  const members = membersQuery.data?.data ?? [];
  const assigneeUserIds = new Set(
    issue.assignees?.map((a) => a.user.id) ?? [],
  );

  const filtered = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email.toLowerCase().includes(search.toLowerCase()),
  );

  const assignees = issue.assignees ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full items-center justify-center rounded-sm hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
        >
          {assignees.length === 0 ? (
            <span className="text-xs text-muted-foreground">--</span>
          ) : (
            <div className="flex items-center">
              {assignees.slice(0, 2).map((a) => (
                <Avatar
                  key={a.id}
                  src={a.user.avatarUrl}
                  fallback={a.user.name}
                  size="sm"
                  className="-ml-1 first:ml-0"
                />
              ))}
              {assignees.length > 2 && (
                <span className="ml-0.5 text-xs text-muted-foreground">
                  +{assignees.length - 2}
                </span>
              )}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[240px] p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="멤버 검색..."
            autoFocus
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {filtered.map((member) => {
            const isAssigned = assigneeUserIds.has(member.user.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  if (isAssigned) {
                    removeAssignee.mutate(member.user.id);
                  } else {
                    addAssignee.mutate(member.user.id);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Avatar
                  src={member.user.avatarUrl}
                  fallback={member.user.name}
                  size="sm"
                />
                <span className="flex-1 truncate text-left">
                  {member.user.name}
                </span>
                {isAssigned && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
        {assignees.length > 0 && (
          <>
            <Separator className="my-1" />
            <button
              type="button"
              onClick={() => {
                for (const a of assignees) {
                  removeAssignee.mutate(a.user.id);
                }
              }}
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              선택 해제
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
