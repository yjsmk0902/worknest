import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  Search,
  X,
} from 'lucide-react';
import {
  Avatar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toast,
} from '@worknest/ui';
import { cn } from '@worknest/ui';
import { apiClient } from '../../../lib/api-client';
import { PRIORITY_CONFIG, getTypeIcon, type Priority } from '../../../lib/issue-constants';
import type {
  IssueOutput,
  IssueStatusOutput,
  IssueTypeOutput,
} from '@worknest/shared';

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
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface IssuePropertiesProps {
  issue: IssueOutput;
  projectId: string;
  mode: 'panel' | 'sidebar';
}

// ── Main Component ──────────────────────────────────────────────────────

export function IssueProperties({
  issue,
  projectId,
  mode,
}: IssuePropertiesProps) {
  const queryClient = useQueryClient();

  // Fetch statuses
  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () =>
      apiClient.get<IssueStatusOutput[]>(
        `/projects/${projectId}/statuses`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch types
  const typesQuery = useQuery<IssueTypeOutput[]>({
    queryKey: ['projects', projectId, 'types'],
    queryFn: () =>
      apiClient.get<IssueTypeOutput[]>(
        `/projects/${projectId}/types`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch labels
  const labelsQuery = useQuery<LabelOutput[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () =>
      apiClient.get<LabelOutput[]>(`/projects/${projectId}/labels`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch members
  const membersQuery = useQuery<{ data: MemberOutput[] }>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () =>
      apiClient.getList<MemberOutput>(`/projects/${projectId}/members`),
    staleTime: 5 * 60 * 1000,
  });

  // Update issue mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch<IssueOutput>(
        `/projects/${projectId}/issues/${issue.id}`,
        data,
      ),
    onMutate: async (newData) => {
      const queryKey = ['projects', projectId, 'issues', issue.id];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: IssueOutput | undefined) =>
        old ? { ...old, ...newData } : old,
      );
      return { previous, queryKey };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast('변경에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
  });

  // Assignee mutations
  const addAssigneeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/projects/${projectId}/issues/${issue.id}/assignees`, {
        userId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issue.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => toast('담당자 추가에 실패했습니다.'),
  });

  const removeAssigneeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(
        `/projects/${projectId}/issues/${issue.id}/assignees/${userId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issue.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => toast('담당자 제거에 실패했습니다.'),
  });

  // Label mutations
  const addLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      apiClient.post(`/projects/${projectId}/issues/${issue.id}/labels`, {
        labelId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issue.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => toast('라벨 추가에 실패했습니다.'),
  });

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      apiClient.delete(
        `/projects/${projectId}/issues/${issue.id}/labels/${labelId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issue.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
    onError: () => toast('라벨 제거에 실패했습니다.'),
  });

  const statuses = statusesQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const allLabels = labelsQuery.data ?? [];
  const members = membersQuery.data?.data ?? [];

  const assigneeUserIds = new Set(
    issue.assignees?.map((a) => a.user.id) ?? [],
  );
  const issueLabelIds = new Set(
    issue.labels?.map((l) => l.label.id) ?? [],
  );

  const containerClass =
    mode === 'panel'
      ? 'grid grid-cols-[100px_1fr] gap-y-2 border-b border-border px-4 py-3'
      : 'space-y-4 border-l border-border p-4';

  if (mode === 'sidebar') {
    return (
      <div className="w-[240px] space-y-4 overflow-y-auto border-l border-border p-4">
        {/* Status */}
        <PropertySection label="상태">
          <StatusSelect
            statuses={statuses}
            currentStatusId={issue.statusId}
            onChange={(statusId) => updateMutation.mutate({ statusId })}
          />
        </PropertySection>

        <Separator />

        {/* Priority */}
        <PropertySection label="우선순위">
          <PrioritySelect
            current={issue.priority as Priority}
            onChange={(priority) => updateMutation.mutate({ priority })}
          />
        </PropertySection>

        <Separator />

        {/* Type */}
        <PropertySection label="타입">
          <TypeSelect
            types={types}
            currentTypeId={issue.typeId}
            onChange={(typeId) => updateMutation.mutate({ typeId })}
          />
        </PropertySection>

        <Separator />

        {/* Assignees */}
        <PropertySection label="담당자">
          <AssigneePicker
            members={members}
            assigneeUserIds={assigneeUserIds}
            issueAssignees={issue.assignees ?? []}
            onAdd={(userId) => addAssigneeMutation.mutate(userId)}
            onRemove={(userId) => removeAssigneeMutation.mutate(userId)}
          />
        </PropertySection>

        <Separator />

        {/* Labels */}
        <PropertySection label="라벨">
          <LabelPicker
            allLabels={allLabels}
            issueLabelIds={issueLabelIds}
            issueLabels={issue.labels ?? []}
            onAdd={(labelId) => addLabelMutation.mutate(labelId)}
            onRemove={(labelId) => removeLabelMutation.mutate(labelId)}
          />
        </PropertySection>

        <Separator />

        {/* Due date */}
        <PropertySection label="마감일">
          <DueDatePicker
            dueDate={issue.dueDate}
            onChange={(dueDate) => updateMutation.mutate({ dueDate })}
          />
        </PropertySection>

        <Separator />

        {/* Metadata */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            생성일: {new Date(issue.createdAt).toLocaleDateString('ko-KR')}
          </p>
          <p className="text-xs text-muted-foreground">
            수정일: {formatRelativeTime(issue.updatedAt)}
          </p>
        </div>
      </div>
    );
  }

  // Panel (compact) mode
  return (
    <div className={containerClass}>
      {/* Status */}
      <span className="self-center text-sm text-muted-foreground">상태</span>
      <StatusSelect
        statuses={statuses}
        currentStatusId={issue.statusId}
        onChange={(statusId) => updateMutation.mutate({ statusId })}
      />

      {/* Priority */}
      <span className="self-center text-sm text-muted-foreground">
        우선순위
      </span>
      <PrioritySelect
        current={issue.priority as Priority}
        onChange={(priority) => updateMutation.mutate({ priority })}
      />

      {/* Type */}
      <span className="self-center text-sm text-muted-foreground">타입</span>
      <TypeSelect
        types={types}
        currentTypeId={issue.typeId}
        onChange={(typeId) => updateMutation.mutate({ typeId })}
      />

      {/* Assignees */}
      <span className="self-center text-sm text-muted-foreground">담당자</span>
      <AssigneePicker
        members={members}
        assigneeUserIds={assigneeUserIds}
        issueAssignees={issue.assignees ?? []}
        onAdd={(userId) => addAssigneeMutation.mutate(userId)}
        onRemove={(userId) => removeAssigneeMutation.mutate(userId)}
      />

      {/* Labels */}
      <span className="self-center text-sm text-muted-foreground">라벨</span>
      <LabelPicker
        allLabels={allLabels}
        issueLabelIds={issueLabelIds}
        issueLabels={issue.labels ?? []}
        onAdd={(labelId) => addLabelMutation.mutate(labelId)}
        onRemove={(labelId) => removeLabelMutation.mutate(labelId)}
      />

      {/* Due date */}
      <span className="self-center text-sm text-muted-foreground">마감일</span>
      <DueDatePicker
        dueDate={issue.dueDate}
        onChange={(dueDate) => updateMutation.mutate({ dueDate })}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function PropertySection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Status Select ───────────────────────────────────────────────────────

function StatusSelect({
  statuses,
  currentStatusId,
  onChange,
}: {
  statuses: IssueStatusOutput[];
  currentStatusId: string | null;
  onChange: (statusId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((s) => s.id === currentStatusId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-border px-2 text-sm hover:bg-accent"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: current?.color ?? '#94a3b8' }}
          />
          <span>{current?.name ?? '상태 없음'}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1">
        {statuses.map((status) => (
          <button
            key={status.id}
            type="button"
            onClick={() => {
              onChange(status.id);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="flex-1 text-left">{status.name}</span>
            {status.id === currentStatusId && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Priority Select ─────────────────────────────────────────────────────

function PrioritySelect({
  current,
  onChange,
}: {
  current: Priority;
  onChange: (priority: Priority) => void;
}) {
  const [open, setOpen] = useState(false);
  const config = PRIORITY_CONFIG[current] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = config.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-border px-2 text-sm hover:bg-accent"
        >
          <PriorityIcon className={cn('h-4 w-4', config.color)} />
          <span>{config.label}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1">
        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => {
          const pConfig = PRIORITY_CONFIG[priority];
          const PIcon = pConfig.icon;
          return (
            <button
              key={priority}
              type="button"
              onClick={() => {
                onChange(priority);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <PIcon className={cn('h-4 w-4', pConfig.color)} />
              <span className="flex-1 text-left">{pConfig.label}</span>
              {priority === current && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ── Type Select ─────────────────────────────────────────────────────────

function TypeSelect({
  types,
  currentTypeId,
  onChange,
}: {
  types: IssueTypeOutput[];
  currentTypeId: string | null;
  onChange: (typeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = types.find((t) => t.id === currentTypeId);
  const CurrentIcon = getTypeIcon(current?.icon);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-border px-2 text-sm hover:bg-accent"
        >
          <CurrentIcon className="h-4 w-4 text-muted-foreground" />
          <span>{current?.name ?? '타입 없음'}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1">
        {types.map((type) => {
          const TypeIcon = getTypeIcon(type.icon);
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                onChange(type.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <TypeIcon className="h-4 w-4" style={{ color: type.color }} />
              <span className="flex-1 text-left">{type.name}</span>
              {type.id === currentTypeId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ── Assignee Picker ─────────────────────────────────────────────────────

function AssigneePicker({
  members,
  assigneeUserIds,
  issueAssignees,
  onAdd,
  onRemove,
}: {
  members: MemberOutput[];
  assigneeUserIds: Set<string>;
  issueAssignees: NonNullable<IssueOutput['assignees']>;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-[32px] items-center gap-2 rounded-md border border-border px-2 text-sm hover:bg-accent"
        >
          {issueAssignees.length === 0 ? (
            <span className="text-muted-foreground">담당자 없음</span>
          ) : (
            <div className="flex items-center gap-1">
              <Avatar
                src={issueAssignees[0].user.avatarUrl}
                fallback={issueAssignees[0].user.name}
                size="sm"
              />
              <span className="truncate">{issueAssignees[0].user.name}</span>
              {issueAssignees.length > 1 && (
                <span className="text-muted-foreground">
                  +{issueAssignees.length - 1}
                </span>
              )}
            </div>
          )}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-2">
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
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.map((member) => {
            const isAssigned = assigneeUserIds.has(member.user.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  if (isAssigned) {
                    onRemove(member.user.id);
                  } else {
                    onAdd(member.user.id);
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
        {issueAssignees.length > 0 && (
          <>
            <Separator className="my-1" />
            <button
              type="button"
              onClick={() => {
                for (const a of issueAssignees) {
                  onRemove(a.user.id);
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

// ── Label Picker ────────────────────────────────────────────────────────

function LabelPicker({
  allLabels,
  issueLabelIds,
  issueLabels,
  onAdd,
  onRemove,
}: {
  allLabels: LabelOutput[];
  issueLabelIds: Set<string>;
  issueLabels: NonNullable<IssueOutput['labels']>;
  onAdd: (labelId: string) => void;
  onRemove: (labelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = allLabels.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex min-h-[32px] flex-wrap items-center gap-1 rounded-md border border-border px-2 py-1 text-sm hover:bg-accent"
        >
          {issueLabels.length === 0 ? (
            <span className="text-muted-foreground">라벨 없음</span>
          ) : (
            issueLabels.map((il) => (
              <span
                key={il.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${il.label.color}1a`,
                  color: il.label.color,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: il.label.color }}
                />
                {il.label.name}
              </span>
            ))
          )}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-2">
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="라벨 검색..."
            autoFocus
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.map((label) => {
            const isSelected = issueLabelIds.has(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onRemove(label.id);
                  } else {
                    onAdd(label.id);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 text-left">{label.name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Due Date Picker ─────────────────────────────────────────────────────

function DueDatePicker({
  dueDate,
  onChange,
}: {
  dueDate: string | null;
  onChange: (dueDate: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <input
        type="date"
        value={dueDate ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 rounded-md border border-border bg-transparent px-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {dueDate && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
          aria-label="날짜 제거"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ── Utilities ───────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}일 전`;

  return date.toLocaleDateString('ko-KR');
}
