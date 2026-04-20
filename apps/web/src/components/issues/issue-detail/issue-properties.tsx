import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type {
  CycleOutput,
  IssueOutput,
  IssueStatusOutput,
  IssueTypeOutput,
  StatusCategory,
} from '@worknest/shared';
import { Avatar, Popover, PopoverContent, PopoverTrigger, Separator, toast } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { Calendar, Check, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { PRIORITY_CONFIG, type Priority, getTypeIcon } from '../../../lib/issue-constants';
import { CategoryGlyph, type GroupCategory } from '../../../lib/status-category-config';

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
  orgSlug?: string;
  wsSlug?: string;
}

// ── Main Component ──────────────────────────────────────────────────────

export function IssueProperties({ issue, projectId, mode, orgSlug, wsSlug }: IssuePropertiesProps) {
  const queryClient = useQueryClient();

  // Fetch statuses
  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => apiClient.get<IssueStatusOutput[]>(`/projects/${projectId}/statuses`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch types
  const typesQuery = useQuery<IssueTypeOutput[]>({
    queryKey: ['projects', projectId, 'types'],
    queryFn: () => apiClient.get<IssueTypeOutput[]>(`/projects/${projectId}/types`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch labels
  const labelsQuery = useQuery<LabelOutput[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => apiClient.get<LabelOutput[]>(`/projects/${projectId}/labels`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch members
  const membersQuery = useQuery<{ data: MemberOutput[] }>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => apiClient.getList<MemberOutput>(`/projects/${projectId}/members`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch cycles for this issue
  // Deferred to v1.0: Replace with a dedicated backend endpoint
  // (e.g. GET /issues/:issueId/cycles) to avoid N+1 fetches.
  // Current approach works for MVP given the typical cycle count (< 5).
  const issueCyclesQuery = useQuery<CycleOutput[]>({
    queryKey: ['issues', issue.id, 'cycles'],
    queryFn: async () => {
      // Fetch all non-completed cycles, then check membership in parallel
      const cyclesRes = await apiClient.getList<CycleOutput>(`/projects/${projectId}/cycles`);
      const activeCycles = cyclesRes.data.filter((c) => c.status !== 'completed');

      const checks = await Promise.all(
        activeCycles.map(async (cycle) => {
          try {
            const issuesRes = await apiClient.getList<IssueOutput>(`/cycles/${cycle.id}/issues`);
            return issuesRes.data.some((i) => i.id === issue.id) ? cycle : null;
          } catch {
            return null;
          }
        }),
      );

      return checks.filter((c): c is CycleOutput => c !== null);
    },
    staleTime: 60 * 1000,
  });

  const issueCycles = issueCyclesQuery.data ?? [];

  // Update issue mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch<IssueOutput>(`/projects/${projectId}/issues/${issue.id}`, data),
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
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'board-issues'],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'gantt-issues'],
      });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'issues', issue.id],
    });
    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'issues'],
    });
    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'board-issues'],
    });
    queryClient.invalidateQueries({
      queryKey: ['projects', projectId, 'gantt-issues'],
    });
  };

  // Assignee mutations
  const addAssigneeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/projects/${projectId}/issues/${issue.id}/assignees`, {
        userId,
      }),
    onSuccess: invalidateAll,
    onError: () => toast('담당자 추가에 실패했습니다.'),
  });

  const removeAssigneeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/projects/${projectId}/issues/${issue.id}/assignees/${userId}`),
    onSuccess: invalidateAll,
    onError: () => toast('담당자 제거에 실패했습니다.'),
  });

  // Label mutations
  const addLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      apiClient.post(`/projects/${projectId}/issues/${issue.id}/labels`, {
        labelId,
      }),
    onSuccess: invalidateAll,
    onError: () => toast('라벨 추가에 실패했습니다.'),
  });

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      apiClient.delete(`/projects/${projectId}/issues/${issue.id}/labels/${labelId}`),
    onSuccess: invalidateAll,
    onError: () => toast('라벨 제거에 실패했습니다.'),
  });

  const statuses = statusesQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const allLabels = labelsQuery.data ?? [];
  const members = membersQuery.data?.data ?? [];

  const assigneeUserIds = new Set(issue.assignees?.map((a) => a.user.id) ?? []);
  const issueLabelIds = new Set(issue.labels?.map((l) => l.label.id) ?? []);

  const containerClass =
    mode === 'panel'
      ? 'grid grid-cols-[72px_1fr] items-center justify-items-start gap-x-4 gap-y-2 px-6 pb-6'
      : 'space-y-4 border-l border-border p-4';

  if (mode === 'sidebar') {
    return (
      <div className="w-[360px] shrink-0 space-y-4 overflow-y-auto border-l border-border p-5">
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

        {/* Cycle */}
        <PropertySection label="사이클">
          <CyclePicker
            issueId={issue.id}
            issueCycles={issueCycles}
            projectId={projectId}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
          />
        </PropertySection>

        <Separator />

        {/* Date range */}
        <PropertySection label="기간">
          <DateRangePicker
            startDate={issue.startDate}
            dueDate={issue.dueDate}
            onChangeStart={(startDate) => updateMutation.mutate({ startDate })}
            onChangeDue={(dueDate) => updateMutation.mutate({ dueDate })}
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
      <span className="self-center text-sm text-muted-foreground">우선순위</span>
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

      {/* Cycle */}
      <span className="self-center text-sm text-muted-foreground">사이클</span>
      <CyclePicker
        issueId={issue.id}
        issueCycles={issueCycles}
        projectId={projectId}
        orgSlug={orgSlug}
        wsSlug={wsSlug}
      />

      {/* Date range */}
      <span className="self-center text-sm text-muted-foreground">기간</span>
      <DateRangePicker
        startDate={issue.startDate}
        dueDate={issue.dueDate}
        onChangeStart={(startDate) => updateMutation.mutate({ startDate })}
        onChangeDue={(dueDate) => updateMutation.mutate({ dueDate })}
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
          className="flex h-8 items-center gap-2 rounded-md bg-[color:var(--bg-3)] px-[10px] text-[13px] text-[color:var(--fg-1)] transition-colors hover:bg-[color:var(--bg-4)]"
        >
          <StatusCategoryIcon
            category={current?.category as StatusCategory | undefined}
            color={current?.color}
          />
          <span>{current?.name ?? '상태 없음'}</span>
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
            <StatusCategoryIcon
              category={status.category as StatusCategory | undefined}
              color={status.color}
            />
            <span className="flex-1 text-left">{status.name}</span>
            {status.id === currentStatusId && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Status icon — delegates to the shared CategoryGlyph so the list, board,
 * and panel all stay in sync (including the 'review' category).
 */
function StatusCategoryIcon({
  category,
  color,
}: {
  category: StatusCategory | undefined;
  color?: string;
}) {
  return <CategoryGlyph category={category as GroupCategory | undefined} color={color} size={12} />;
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
          className="flex h-8 items-center gap-2 rounded-md bg-[color:var(--bg-3)] px-[10px] text-[13px] text-[color:var(--fg-1)] transition-colors hover:bg-[color:var(--bg-4)]"
        >
          <PriorityIcon className={cn('h-4 w-4', config.color)} />
          <span>{config.label}</span>
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
              {priority === current && <Check className="h-4 w-4 text-primary" />}
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
          className="flex h-8 items-center gap-2 rounded-md bg-[color:var(--bg-3)] px-[10px] text-[13px] text-[color:var(--fg-1)] transition-colors hover:bg-[color:var(--bg-4)]"
        >
          {current && (
            <CurrentIcon
              className="h-4 w-4"
              style={{ color: current.color || 'var(--fg-3)' }}
            />
          )}
          <span>{current?.name ?? '타입 없음'}</span>
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
              {type.id === currentTypeId && <Check className="h-4 w-4 text-primary" />}
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
          className="flex min-h-[32px] items-center gap-2 rounded-md bg-[color:var(--bg-3)] px-[10px] text-[13px] text-[color:var(--fg-1)] transition-colors hover:bg-[color:var(--bg-4)]"
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
                <span className="text-muted-foreground">+{issueAssignees.length - 1}</span>
              )}
            </div>
          )}
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
                <Avatar src={member.user.avatarUrl} fallback={member.user.name} size="sm" />
                <span className="flex-1 truncate text-left">{member.user.name}</span>
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

  const filtered = allLabels.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {/* Each label as its own pill with inline remove */}
      {issueLabels.map((il) => (
        <span
          key={il.id}
          className="inline-flex h-[26px] items-center gap-[6px] rounded-md bg-[color:var(--bg-3)] px-[10px] text-[12px] text-[color:var(--fg-1)]"
        >
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: il.label.color }}
          />
          {il.label.name}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(il.label.id);
            }}
            className="-mr-1 grid h-[14px] w-[14px] shrink-0 place-items-center rounded text-[color:var(--fg-3)] transition-colors hover:bg-[color:var(--bg-4)] hover:text-[color:var(--fg-1)]"
            aria-label={`${il.label.name} 라벨 제거`}
          >
            <X className="h-[10px] w-[10px]" />
          </button>
        </span>
      ))}

      {/* Separate "+ 추가" dashed pill */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-[26px] items-center gap-[6px] rounded-md border border-dashed border-[color:var(--border-strong)] px-[10px] text-[12px] text-[color:var(--fg-3)] transition-colors hover:border-[color:var(--border)] hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)]"
          >
            <Plus className="h-3 w-3" />
            추가
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
    </div>
  );
}

// ── Date Range Picker ──────────────────────────────────────────────────

function DateRangePicker({
  startDate,
  dueDate,
  onChangeStart,
  onChangeDue,
}: {
  startDate: string | null;
  dueDate: string | null;
  onChangeStart: (value: string | null) => void;
  onChangeDue: (value: string | null) => void;
}) {
  const startLocal = startDate ? toLocalDateString(startDate) : '';
  const dueLocal = dueDate ? toLocalDateString(dueDate) : '';
  const hasAny = startDate || dueDate;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        type="date"
        value={startLocal}
        max={dueLocal || undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChangeStart(null);
            return;
          }
          if (dueLocal && v > dueLocal) return;
          onChangeStart(toISOStartOfDay(v));
        }}
        placeholder="시작일"
        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span className="text-muted-foreground text-sm">–</span>
      <input
        type="date"
        value={dueLocal}
        min={startLocal || undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChangeDue(null);
            return;
          }
          if (startLocal && v < startLocal) return;
          onChangeDue(toISOEndOfDay(v));
        }}
        placeholder="마감일"
        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hasAny && (
        <button
          type="button"
          onClick={() => {
            onChangeStart(null);
            onChangeDue(null);
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label="날짜 제거"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function toLocalDateString(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toISOStartOfDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function toISOEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString();
}

// ── Cycle Picker ──────────────────────────────────────────────────────

function CyclePicker({
  issueId,
  issueCycles,
  projectId,
  orgSlug,
  wsSlug,
}: {
  issueId: string;
  issueCycles: CycleOutput[];
  projectId: string;
  orgSlug?: string;
  wsSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const allCyclesQuery = useQuery<{ data: CycleOutput[] }>({
    queryKey: ['projects', projectId, 'cycles'],
    queryFn: () => apiClient.getList<CycleOutput>(`/projects/${projectId}/cycles`),
    staleTime: 60 * 1000,
    enabled: open,
  });

  const addToCycle = useMutation({
    mutationFn: (cycleId: string) => apiClient.post(`/cycles/${cycleId}/issues`, { issueId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', issueId, 'cycles'] });
      toast('사이클에 추가되었습니다.');
    },
    onError: () => toast('사이클 추가에 실패했습니다.'),
  });

  const removeFromCycle = useMutation({
    mutationFn: (cycleId: string) => apiClient.delete(`/cycles/${cycleId}/issues/${issueId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', issueId, 'cycles'] });
      toast('사이클에서 제거되었습니다.');
    },
    onError: () => toast('사이클 제거에 실패했습니다.'),
  });

  const allCycles = (allCyclesQuery.data?.data ?? []).filter((c) => c.status !== 'completed');
  const issueCycleIds = new Set(issueCycles.map((c) => c.id));

  // UX enforces 1:1 (one cycle per issue). Backend supports many but we
  // never add a second one from this picker — switching auto-removes the
  // previous assignment.
  const currentCycle = issueCycles[0];

  async function switchTo(cycleId: string) {
    if (currentCycle && currentCycle.id === cycleId) {
      setOpen(false);
      return;
    }
    if (currentCycle) {
      await removeFromCycle.mutateAsync(currentCycle.id);
    }
    await addToCycle.mutateAsync(cycleId);
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {currentCycle ? (
        <span className="inline-flex h-[26px] items-center gap-[6px] rounded-md bg-[color:var(--bg-3)] px-[10px] text-[12px] text-[color:var(--fg-1)]">
          <RefreshCw className="h-3 w-3 text-[color:var(--fg-3)]" />
          {orgSlug && wsSlug ? (
            <Link
              to={`/${orgSlug}/${wsSlug}/projects/${projectId}/cycles/${currentCycle.id}`}
              className="hover:underline"
            >
              {currentCycle.name}
            </Link>
          ) : (
            currentCycle.name
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFromCycle.mutate(currentCycle.id);
            }}
            className="-mr-1 grid h-[14px] w-[14px] shrink-0 place-items-center rounded text-[color:var(--fg-3)] transition-colors hover:bg-[color:var(--bg-4)] hover:text-[color:var(--fg-1)]"
            aria-label={`${currentCycle.name} 사이클에서 제거`}
          >
            <X className="h-[10px] w-[10px]" />
          </button>
        </span>
      ) : null}

      {/* + 추가 — only when no current cycle (one-per-issue enforcement) */}
      {!currentCycle && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-[26px] items-center gap-[6px] rounded-md border border-dashed border-[color:var(--border-strong)] px-[10px] text-[12px] text-[color:var(--fg-3)] transition-colors hover:border-[color:var(--border)] hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)]"
            >
              <Plus className="h-3 w-3" />
              추가
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[240px] p-2">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">사이클 선택</p>
            {allCycles.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                사이클이 없습니다
              </p>
            )}
            <div className="max-h-[240px] overflow-y-auto">
              {allCycles.map((cycle) => {
                const isInCycle = issueCycleIds.has(cycle.id);
                return (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => switchTo(cycle.id)}
                    disabled={addToCycle.isPending || removeFromCycle.isPending}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate text-left">{cycle.name}</span>
                    <span className="text-[10px] capitalize text-muted-foreground">
                      {cycle.status}
                    </span>
                    {isInCycle && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
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
