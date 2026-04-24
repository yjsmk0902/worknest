import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type IssueOutput, type IssueStatusOutput, generateKeyBetween } from '@worknest/shared';
import { Button, ScrollArea, toast } from '@worknest/ui';
import { Columns3, Plus } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { KanbanCard } from './kanban-card';
import { KanbanColumn } from './kanban-column';

// ── Safe key generation ──────────────────────────────────────────────

function safeGenerateKeyBetween(a: string | null, b: string | null): string {
  try {
    // If a >= b (duplicate sortOrders), ignore b and just place after a
    if (a != null && b != null && a >= b) {
      return generateKeyBetween(a, null);
    }
    return generateKeyBetween(a, b);
  } catch {
    // Fallback: generate after a
    return generateKeyBetween(a, null);
  }
}

// ── Sort helpers ─────────────────────────────────────────────────────

function getIssueSortValue(issue: IssueOutput, field: string | undefined): string | number {
  switch (field) {
    case 'priority': {
      const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      return order[issue.priority] ?? 4;
    }
    case 'created_at':
      return issue.createdAt;
    case 'updated_at':
      return issue.updatedAt;
    case 'due_date':
      return issue.dueDate ?? '\uffff';
    case 'title':
      return issue.title.toLowerCase();
    default:
      return issue.sortOrder;
  }
}

function sortIssues(
  a: IssueOutput,
  b: IssueOutput,
  field: string | undefined,
  order: string,
): number {
  const va = getIssueSortValue(a, field);
  const vb = getIssueSortValue(b, field);
  let cmp: number;
  if (typeof va === 'number' && typeof vb === 'number') {
    cmp = va - vb;
  } else if (!field || field === 'manual') {
    // fractional-indexing keys compare byte-wise, not via locale. Mixing
    // them means visual order can diverge from the key order, which makes
    // `generateKeyBetween(above, below)` produce keys that collide with
    // existing ones.
    const sa = String(va);
    const sb = String(vb);
    cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
  } else {
    cmp = String(va).localeCompare(String(vb));
  }
  return order === 'desc' ? -cmp : cmp;
}

function findSortedInsertIndex(
  issue: IssueOutput,
  sortedIssues: IssueOutput[],
  field: string | undefined,
  order: string,
): number {
  const val = getIssueSortValue(issue, field);
  for (let i = 0; i < sortedIssues.length; i++) {
    const other = getIssueSortValue(sortedIssues[i], field);
    let cmp: number;
    if (typeof val === 'number' && typeof other === 'number') {
      cmp = val - other;
    } else {
      cmp = String(val).localeCompare(String(other));
    }
    if (order === 'desc') cmp = -cmp;
    if (cmp <= 0) return i;
  }
  return sortedIssues.length;
}

// Custom collision detection for kanban board.
// Prefer card-level hits for precise positioning, fall back to column for empty areas.
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    // Filter out the dragged item itself
    const activeId = args.active.id;
    const others = pointerCollisions.filter((c) => c.id !== activeId);
    if (others.length === 0) return pointerCollisions;

    // Prefer card droppables for precise positioning within a column
    const cardHits = others.filter((c) => !String(c.id).startsWith('column-'));
    if (cardHits.length > 0) return cardHits;
    return others;
  }
  return rectIntersection(args);
};

export type BoardGroupBy = 'status' | 'priority' | 'assignee' | 'label';

export interface BoardMember {
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

interface KanbanBoardProps {
  statuses: IssueStatusOutput[];
  issues: IssueOutput[];
  stats: Record<string, number>;
  projectId: string;
  projectPrefix: string;
  sortField?: string;
  sortOrder?: string;
  groupBy?: BoardGroupBy;
  members?: BoardMember[];
  labels?: BoardLabel[];
  onCardClick: (issueId: string) => void;
  onCreateClick: () => void;
}

const PRIORITY_COLUMNS: { id: string; value: 'urgent' | 'high' | 'medium' | 'low' | 'none'; name: string; color: string }[] = [
  { id: 'priority-urgent', value: 'urgent', name: '긴급', color: '#e5484d' },
  { id: 'priority-high', value: 'high', name: '높음', color: '#f76808' },
  { id: 'priority-medium', value: 'medium', name: '보통', color: '#f5a524' },
  { id: 'priority-low', value: 'low', name: '낮음', color: '#30a46c' },
  { id: 'priority-none', value: 'none', name: '없음', color: '#8f8f8f' },
];

const UNASSIGNED_COLUMN_ID = '__unassigned';
const NO_LABEL_COLUMN_ID = '__nolabel';

export function KanbanBoard({
  statuses,
  issues,
  stats,
  projectId,
  projectPrefix,
  sortField,
  sortOrder = 'asc',
  groupBy = 'status',
  members = [],
  labels = [],
  onCardClick,
  onCreateClick,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [overCardId, setOverCardId] = useState<string | null>(null);
  const [dropAbove, setDropAbove] = useState<boolean>(true);
  const isManualSort = !sortField || sortField === 'manual';
  const dragOriginalStatusRef = useRef<string | null>(null);
  const dragStartPointerYRef = useRef<number>(0);
  const pointerYRef = useRef<number>(0);
  // Center Y of the dragged card at drag-start (used to derive the overlay's
  // current center via `initialCenter + delta.y`, which matches what the user
  // visually sees as "where the card is" better than the raw pointer Y).
  const dragCardInitialCenterYRef = useRef<number>(0);
  const cardCenterYRef = useRef<number>(0);

  // Local copy of issues for optimistic DnD reordering
  const [localIssues, setLocalIssues] = useState<IssueOutput[]>(issues);

  // Keep local issues in sync with server data when not dragging
  const prevIssuesRef = useRef(issues);
  if (issues !== prevIssuesRef.current && !activeId) {
    prevIssuesRef.current = issues;
    setLocalIssues(issues);
  }

  // Build columns based on groupBy
  const columns = useMemo((): IssueStatusOutput[] => {
    if (groupBy === 'priority') {
      return PRIORITY_COLUMNS.map(
        (p) =>
          ({
            id: p.id,
            projectId,
            name: p.name,
            color: p.color,
            sortOrder: 0,
            category: null as never,
            isDefault: false,
          }) as unknown as IssueStatusOutput,
      );
    }
    if (groupBy === 'assignee') {
      const memberCols = members.map(
        (m) =>
          ({
            id: m.userId,
            projectId,
            name: m.user.name,
            color: '#6366f1',
            sortOrder: 0,
            category: null as never,
            isDefault: false,
          }) as unknown as IssueStatusOutput,
      );
      return [
        ...memberCols,
        {
          id: UNASSIGNED_COLUMN_ID,
          projectId,
          name: '미지정',
          color: '#8f8f8f',
          sortOrder: 0,
          category: null as never,
          isDefault: false,
        } as unknown as IssueStatusOutput,
      ];
    }
    if (groupBy === 'label') {
      const labelCols = labels.map(
        (l) =>
          ({
            id: l.id,
            projectId,
            name: l.name,
            color: l.color,
            sortOrder: 0,
            category: null as never,
            isDefault: false,
          }) as unknown as IssueStatusOutput,
      );
      return [
        ...labelCols,
        {
          id: NO_LABEL_COLUMN_ID,
          projectId,
          name: '라벨 없음',
          color: '#8f8f8f',
          sortOrder: 0,
          category: null as never,
          isDefault: false,
        } as unknown as IssueStatusOutput,
      ];
    }
    return statuses;
  }, [groupBy, statuses, members, labels, projectId]);

  // Resolve which column a given issue belongs to, based on groupBy
  const getIssueColumnId = useCallback(
    (issue: IssueOutput): string => {
      if (groupBy === 'priority') return `priority-${issue.priority}`;
      if (groupBy === 'assignee') return issue.assignees?.[0]?.userId ?? UNASSIGNED_COLUMN_ID;
      if (groupBy === 'label') return issue.labels?.[0]?.labelId ?? NO_LABEL_COLUMN_ID;
      return issue.statusId ?? (statuses[0]?.id ?? '');
    },
    [groupBy, statuses],
  );

  // Group issues by columnId
  const issuesByStatus = useMemo(() => {
    const grouped: Record<string, IssueOutput[]> = {};
    for (const col of columns) {
      grouped[col.id] = [];
    }
    const firstColumnId = columns[0]?.id ?? '';
    for (const issue of localIssues) {
      const cid = getIssueColumnId(issue);
      if (grouped[cid]) {
        grouped[cid].push(issue);
      } else if (firstColumnId && grouped[firstColumnId]) {
        grouped[firstColumnId].push(issue);
      }
    }
    // Sort each column
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => sortIssues(a, b, sortField, sortOrder));
    }
    return grouped;
  }, [columns, localIssues, sortField, sortOrder, getIssueColumnId]);

  // Check if the board is completely empty
  const totalIssues = localIssues.length;

  // Active issue for DragOverlay
  const activeIssue = useMemo(
    () => localIssues.find((i) => i.id === activeId) ?? null,
    [localIssues, activeId],
  );

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  );

  // Mutation for updating issue fields based on groupBy
  const updateMutation = useMutation({
    mutationFn: async (data: {
      issueId: string;
      targetColumnId: string;
      sortOrder?: string;
      issue: IssueOutput;
    }) => {
      const { issueId, targetColumnId, sortOrder: newSort, issue } = data;
      const patchBody: Record<string, unknown> = {};
      if (newSort !== undefined) patchBody.sortOrder = newSort;

      if (groupBy === 'status') {
        const currentCol = getIssueColumnId(issue);
        if (currentCol !== targetColumnId) patchBody.statusId = targetColumnId;
      } else if (groupBy === 'priority') {
        const currentCol = getIssueColumnId(issue);
        if (currentCol !== targetColumnId) {
          const priority = targetColumnId.replace('priority-', '');
          patchBody.priority = priority;
        }
      } else if (groupBy === 'assignee') {
        const currentCol = getIssueColumnId(issue);
        if (currentCol !== targetColumnId) {
          const newAssigneeIds =
            targetColumnId === UNASSIGNED_COLUMN_ID
              ? []
              : [
                  targetColumnId,
                  ...(issue.assignees ?? [])
                    .map((a) => a.userId)
                    .filter((id) => id !== targetColumnId && id !== currentCol),
                ];
          patchBody.assigneeIds = newAssigneeIds;
        }
      } else if (groupBy === 'label') {
        const currentCol = getIssueColumnId(issue);
        if (currentCol !== targetColumnId) {
          const newLabelIds =
            targetColumnId === NO_LABEL_COLUMN_ID
              ? []
              : [
                  targetColumnId,
                  ...(issue.labels ?? [])
                    .map((l) => l.labelId)
                    .filter((id) => id !== targetColumnId && id !== currentCol),
                ];
          patchBody.labelIds = newLabelIds;
        }
      }

      return apiClient.patch(`/projects/${projectId}/issues/${issueId}`, patchBody);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'board-issues'] });
      toast('이슈 이동에 실패했습니다. 다시 시도해주세요.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'board-issues'] });
    },
  });

  // ── Find which column an item or droppable belongs to ──
  const findColumnId = useCallback(
    (id: string): string | null => {
      // Check if it's a column droppable ID
      if (id.startsWith('column-')) {
        return id.replace('column-', '');
      }
      // It's an issue ID, find which column it's in
      for (const [statusId, columnIssues] of Object.entries(issuesByStatus)) {
        if (columnIssues.some((issue) => issue.id === id)) {
          return statusId;
        }
      }
      return null;
    },
    [issuesByStatus],
  );

  // ── DnD handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      setActiveId(id);
      // Remember the original columnId before handleDragOver mutates localIssues
      const issue = localIssues.find((i) => i.id === id);
      dragOriginalStatusRef.current = issue ? getIssueColumnId(issue) : null;
      // Capture initial pointer Y so onDragMove can derive live pointer.
      const e = event.activatorEvent as PointerEvent | MouseEvent;
      dragStartPointerYRef.current = e.clientY;
      pointerYRef.current = e.clientY;
      // Capture the dragged card's initial center Y. We use this + delta.y
      // to get the overlay's current center, which we compare against other
      // cards' midpoints for insertion — matches user's visual perception.
      const el = document.querySelector<HTMLElement>(`[data-issue-id="${id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        dragCardInitialCenterYRef.current = rect.top + rect.height / 2;
        cardCenterYRef.current = rect.top + rect.height / 2;
      }
    },
    [localIssues, getIssueColumnId],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      pointerYRef.current = dragStartPointerYRef.current + event.delta.y;
      cardCenterYRef.current = dragCardInitialCenterYRef.current + event.delta.y;
      const colId = overColumnId;
      if (!colId) return;
      const colIssues = (issuesByStatus[colId] ?? []).filter(
        (i) => i.id !== activeId,
      );
      const effectiveY = cardCenterYRef.current;
      let insertIndex = colIssues.length;
      for (let i = 0; i < colIssues.length; i++) {
        const issue = colIssues[i];
        if (!issue) continue;
        const el = document.querySelector<HTMLElement>(
          `[data-issue-id="${issue.id}"]`,
        );
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (effectiveY < mid) {
          insertIndex = i;
          break;
        }
      }
      const target = colIssues[insertIndex];
      if (target) {
        setOverCardId(target.id);
        setDropAbove(true);
      } else {
        setOverCardId(null);
      }
    },
    [overColumnId, issuesByStatus, activeId],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setOverColumnId(null);
        setOverCardId(null);
        return;
      }
      setOverColumnId(findColumnId(over.id as string));
    },
    [findColumnId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverColumnId(null);
      setOverCardId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeIssue = localIssues.find((i) => i.id === activeId);
      if (!activeIssue) return;

      const targetColumnId = findColumnId(overId);
      if (!targetColumnId) return;

      const columnIssues = issuesByStatus[targetColumnId] ?? [];
      const otherIssues = columnIssues.filter((i) => i.id !== activeId);

      let newSortOrder: string;

      if (isManualSort) {
        // Pointer-based insert position. For each remaining card in the
        // target column, read its live DOM rect and find the first one whose
        // vertical midpoint is below the pointer — that's where we insert.
        // If pointer is below every card, insert at the end. This keeps the
        // drop in lockstep with the orange indicator regardless of whether
        // @dnd-kit reported `over` as a card or the column.
        const effectiveY = cardCenterYRef.current;
        let insertIndex = otherIssues.length;
        for (let i = 0; i < otherIssues.length; i++) {
          const issue = otherIssues[i];
          if (!issue) continue;
          const el = document.querySelector<HTMLElement>(
            `[data-issue-id="${issue.id}"]`,
          );
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (effectiveY < mid) {
            insertIndex = i;
            break;
          }
        }
        const above = insertIndex > 0 ? otherIssues[insertIndex - 1] : null;
        const below =
          insertIndex < otherIssues.length ? otherIssues[insertIndex] : null;
        newSortOrder = safeGenerateKeyBetween(
          above?.sortOrder ?? null,
          below?.sortOrder ?? null,
        );
      } else {
        // Auto sort: find the correct position based on sort criteria
        const insertIndex = findSortedInsertIndex(activeIssue, otherIssues, sortField, sortOrder);
        const above = insertIndex > 0 ? otherIssues[insertIndex - 1] : null;
        const below = insertIndex < otherIssues.length ? otherIssues[insertIndex] : null;
        newSortOrder = safeGenerateKeyBetween(above?.sortOrder ?? null, below?.sortOrder ?? null);
      }

      // Optimistic update (best-effort — depends on groupBy)
      setLocalIssues((prev) =>
        prev.map((issue) => {
          if (issue.id !== activeId) return issue;
          const base = { ...issue, sortOrder: newSortOrder };
          if (groupBy === 'status') return { ...base, statusId: targetColumnId };
          if (groupBy === 'priority') {
            return { ...base, priority: targetColumnId.replace('priority-', '') as IssueOutput['priority'] };
          }
          return base;
        }),
      );

      dragOriginalStatusRef.current = null;

      updateMutation.mutate({
        issueId: activeId,
        targetColumnId,
        sortOrder: newSortOrder,
        issue: activeIssue,
      });
    },
    [
      localIssues,
      issuesByStatus,
      findColumnId,
      updateMutation,
      sortField,
      sortOrder,
      isManualSort,
      groupBy,
    ],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
    setOverCardId(null);
    // Reset to server state
    setLocalIssues(issues);
  }, [issues]);

  // ── Empty board state ─────────────────────────────────────────────────

  if (totalIssues === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Columns3 className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">이슈를 만들어 보드를 시작하세요</h3>
        <p className="text-sm text-muted-foreground">카드를 드래그하여 상태를 변경할 수 있습니다</p>
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4" />
          이슈 만들기
        </Button>
      </div>
    );
  }

  // ── Board layout ──────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ScrollArea orientation="horizontal" className="h-full" role="region" aria-label="칸반 보드">
        <div className="flex gap-4 px-4 pb-4 h-full">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              status={col}
              issues={issuesByStatus[col.id] ?? []}
              count={
                groupBy === 'status'
                  ? (stats[col.id] ?? issuesByStatus[col.id]?.length ?? 0)
                  : (issuesByStatus[col.id]?.length ?? 0)
              }
              projectId={projectId}
              projectPrefix={projectPrefix}
              onCardClick={onCardClick}
              isOver={overColumnId === col.id}
              activeId={activeId}
              overCardId={isManualSort ? overCardId : null}
              dropAbove={dropAbove}
              disableQuickAdd={groupBy !== 'status'}
            />
          ))}
        </div>
      </ScrollArea>

      <DragOverlay dropAnimation={null}>
        {activeIssue ? (
          <div className="w-[344px] opacity-90 shadow-xl rotate-[1deg] cursor-grabbing">
            <KanbanCard
              issue={activeIssue}
              projectPrefix={projectPrefix}
              onClick={() => {}}
              isDragOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
