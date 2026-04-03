import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Columns3, Plus } from 'lucide-react';
import { Button, ScrollArea, toast } from '@worknest/ui';
import { generateKeyBetween, type IssueOutput, type IssueStatusOutput } from '@worknest/shared';
import { apiClient } from '../../../lib/api-client';
import { KanbanColumn } from './kanban-column';
import { DragOverlayCard } from './drag-overlay-card';

interface KanbanBoardProps {
  statuses: IssueStatusOutput[];
  issues: IssueOutput[];
  stats: Record<string, number>;
  projectId: string;
  projectPrefix: string;
  onCardClick: (issueId: string) => void;
  onCreateClick: () => void;
}

export function KanbanBoard({
  statuses,
  issues,
  stats,
  projectId,
  projectPrefix,
  onCardClick,
  onCreateClick,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Local copy of issues for optimistic DnD reordering
  const [localIssues, setLocalIssues] = useState<IssueOutput[]>(issues);

  // Keep local issues in sync with server data when not dragging
  const prevIssuesRef = useRef(issues);
  if (issues !== prevIssuesRef.current && !activeId) {
    prevIssuesRef.current = issues;
    setLocalIssues(issues);
  }

  // Group issues by statusId
  const issuesByStatus = useMemo(() => {
    const grouped: Record<string, IssueOutput[]> = {};
    for (const status of statuses) {
      grouped[status.id] = [];
    }
    for (const issue of localIssues) {
      const sid = issue.statusId ?? '';
      if (grouped[sid]) {
        grouped[sid].push(issue);
      }
    }
    // Sort each column by sortOrder
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.sortOrder.localeCompare(b.sortOrder));
    }
    return grouped;
  }, [statuses, localIssues]);

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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Mutation for updating issue status/sortOrder
  const updateMutation = useMutation({
    mutationFn: (data: {
      issueId: string;
      statusId?: string;
      sortOrder?: string;
    }) =>
      apiClient.patch(`/projects/${projectId}/issues/${data.issueId}`, {
        ...(data.statusId !== undefined ? { statusId: data.statusId } : {}),
        ...(data.sortOrder !== undefined
          ? { sortOrder: data.sortOrder }
          : {}),
      }),
    onError: () => {
      // Rollback: restore from server
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
      toast('이슈 이동에 실패했습니다. 다시 시도해주세요.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) {
        setOverColumnId(null);
        return;
      }

      const activeColumnId = findColumnId(active.id as string);
      const overColumnId = findColumnId(over.id as string);

      setOverColumnId(overColumnId);

      if (!activeColumnId || !overColumnId || activeColumnId === overColumnId) {
        return;
      }

      // Moving between columns during drag - update local state for visual feedback
      setLocalIssues((prev) => {
        const activeIssue = prev.find((i) => i.id === active.id);
        if (!activeIssue) return prev;

        return prev.map((issue) =>
          issue.id === active.id
            ? { ...issue, statusId: overColumnId }
            : issue,
        );
      });
    },
    [findColumnId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverColumnId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeIssue = localIssues.find((i) => i.id === activeId);
      if (!activeIssue) return;

      // Determine target column
      const targetColumnId = findColumnId(overId);
      if (!targetColumnId) return;

      const columnIssues = issuesByStatus[targetColumnId] ?? [];

      // Filter out the active issue from the column
      const otherIssues = columnIssues.filter((i) => i.id !== activeId);

      // Find the position in the target column
      let newSortOrder: string;

      if (overId.startsWith('column-')) {
        // Dropped on the column itself (not on a specific card)
        // Place at the end
        const lastIssue = otherIssues[otherIssues.length - 1];
        newSortOrder = generateKeyBetween(
          lastIssue?.sortOrder ?? null,
          null,
        );
      } else {
        // Dropped on a specific card - find its position
        const overIndex = otherIssues.findIndex((i) => i.id === overId);

        if (overIndex < 0) {
          // Over item not found in this column, place at end
          const lastIssue = otherIssues[otherIssues.length - 1];
          newSortOrder = generateKeyBetween(
            lastIssue?.sortOrder ?? null,
            null,
          );
        } else {
          // Place before the over item
          const above = overIndex > 0 ? otherIssues[overIndex - 1] : null;
          const below = otherIssues[overIndex];
          newSortOrder = generateKeyBetween(
            above?.sortOrder ?? null,
            below?.sortOrder ?? null,
          );
        }
      }

      // Optimistic update
      setLocalIssues((prev) =>
        prev.map((issue) =>
          issue.id === activeId
            ? {
                ...issue,
                statusId: targetColumnId,
                sortOrder: newSortOrder,
              }
            : issue,
        ),
      );

      // API call
      const payload: { issueId: string; statusId?: string; sortOrder?: string } = {
        issueId: activeId,
        sortOrder: newSortOrder,
      };

      // Only include statusId if it actually changed
      if (activeIssue.statusId !== targetColumnId) {
        payload.statusId = targetColumnId;
      }

      updateMutation.mutate(payload);
    },
    [localIssues, issuesByStatus, findColumnId, updateMutation],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
    // Reset to server state
    setLocalIssues(issues);
  }, [issues]);

  // ── Empty board state ─────────────────────────────────────────────────

  if (totalIssues === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Columns3 className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">
          이슈를 만들어 보드를 시작하세요
        </h3>
        <p className="text-sm text-muted-foreground">
          카드를 드래그하여 상태를 변경할 수 있습니다
        </p>
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
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ScrollArea
        orientation="horizontal"
        className="h-full"
        role="region"
        aria-label="칸반 보드"
      >
        <div className="flex gap-3 px-4 pb-4 h-full">
          {statuses.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              issues={issuesByStatus[status.id] ?? []}
              count={stats[status.id] ?? issuesByStatus[status.id]?.length ?? 0}
              projectId={projectId}
              projectPrefix={projectPrefix}
              onCardClick={onCardClick}
              isOver={overColumnId === status.id}
            />
          ))}
        </div>
      </ScrollArea>

      <DragOverlay>
        {activeIssue ? (
          <DragOverlayCard
            issue={activeIssue}
            projectPrefix={projectPrefix}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
