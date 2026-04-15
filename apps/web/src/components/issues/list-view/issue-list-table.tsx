import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { generateKeyBetween } from '@worknest/shared';
import type { IssueOutput } from '@worknest/shared';
import { Skeleton, toast } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { CirclePlus, GripVertical, Loader2, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { EmptyState } from '../../empty-state';
import { createIssueColumns } from './columns';

// ── Types ───────────────────────────────────────────────────────────────

interface IssueListTableProps {
  issues: IssueOutput[];
  projectPrefix: string;
  projectId: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  focusedIndex: number;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  onRowClick: (issueId: string) => void;
  onRowDoubleClick: (issueId: string) => void;
  activeIssueId?: string | null;
  onShowQuickAdd: () => void;
  hasFilters: boolean;
  onClearFilters?: () => void;
  isManualSort?: boolean;
}

function safeGenerateKey(a: string | null, b: string | null): string {
  try {
    if (a != null && b != null && a >= b) return generateKeyBetween(a, null);
    return generateKeyBetween(a, b);
  } catch {
    return generateKeyBetween(a, null);
  }
}

// ── Column width mapping ────────────────────────────────────────────────

const COL_WIDTH: Record<string, string> = {
  select: 'w-[40px] justify-center',
  priority: 'w-[40px]',
  drag: 'w-[28px]',
  issueKey: 'w-[80px]',
  title: 'flex-1 min-w-0 overflow-hidden',
  status: 'w-[120px]',
  type: 'w-[100px]',
  assignee: 'w-[140px]',
  cycle: 'w-[120px]',
  startDate: 'w-[120px]',
  dueDate: 'w-[120px]',
};

function colClass(id: string) {
  return COL_WIDTH[id] ?? '';
}

// ── Component ───────────────────────────────────────────────────────────

export function IssueListTable({
  issues,
  projectPrefix,
  projectId,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  focusedIndex,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  onRowDoubleClick,
  activeIssueId,
  onShowQuickAdd,
  hasFilters,
  onClearFilters,
  isManualSort = false,
}: IssueListTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const columns = useMemo(
    () => createIssueColumns(projectPrefix, projectId),
    [projectPrefix, projectId],
  );

  const table = useReactTable({
    data: issues,
    columns,
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: (row) => !row.original.id.startsWith('temp-'),
  });

  const { rows } = table.getRowModel();

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Scroll sentinel for infinite loading
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < rows.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, rows.length, virtualizer]);

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (data: { issueId: string; sortOrder: string }) =>
      apiClient.patch(`/projects/${projectId}/issues/${data.issueId}`, {
        sortOrder: data.sortOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issues'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'board-issues'] });
    },
    onError: () => toast('이동에 실패했습니다.'),
  });

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, issueId: string) => {
    setDragId(issueId);
    e.dataTransfer.effectAllowed = 'move';
    // Use a tiny transparent image so default ghost doesn't show
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, issueId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(issueId);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIssueId: string) => {
      e.preventDefault();
      if (!dragId || dragId === targetIssueId) {
        setDragId(null);
        setDropTargetId(null);
        return;
      }

      const otherIssues = issues.filter((i) => i.id !== dragId);
      const targetIndex = otherIssues.findIndex((i) => i.id === targetIssueId);

      if (targetIndex < 0) {
        setDragId(null);
        setDropTargetId(null);
        return;
      }

      const above = targetIndex > 0 ? otherIssues[targetIndex - 1] : null;
      const below = otherIssues[targetIndex];
      const newSortOrder = safeGenerateKey(above?.sortOrder ?? null, below?.sortOrder ?? null);

      reorderMutation.mutate({ issueId: dragId, sortOrder: newSortOrder });
      setDragId(null);
      setDropTargetId(null);
    },
    [dragId, issues, reorderMutation],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropTargetId(null);
  }, []);

  // ── Loading state ───────────────────────────────────────────────────

  if (isLoading) {
    return <IssueListSkeleton />;
  }

  // ── Empty states ────────────────────────────────────────────────────

  if (issues.length === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={SearchX}
          title="조건에 맞는 이슈가 없습니다"
          description="필터 조건을 변경하거나 초기화해보세요"
          action={onClearFilters ? { label: '필터 초기화', onClick: onClearFilters } : undefined}
        />
      );
    }

    return (
      <EmptyState
        icon={CirclePlus}
        title="C 를 눌러 첫 이슈를 만들어보세요"
        description="이슈를 만들어 프로젝트의 작업을 추적하세요"
        action={{
          label: '이슈 만들기',
          onClick: onShowQuickAdd,
        }}
      />
    );
  }

  // ── Table render ────────────────────────────────────────────────────

  return (
    <div
      className="rounded-xl bg-card shadow-sm ring-1 ring-border/50"
      role="grid"
      aria-label="이슈 목록"
    >
      {/* Header */}
      <div
        className="flex h-9 items-center border-b border-border/40 px-3"
        role="row"
        aria-rowindex={1}
      >
        {isManualSort && <div className="w-[28px]" />}
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              role="columnheader"
              className={cn('flex items-center', colClass(header.id))}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          )),
        )}
      </div>

      {/* Virtual scrolling body */}
      <div ref={parentRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            const isTemp = row.original.id.startsWith('temp-');
            const isFocused = virtualRow.index === focusedIndex;
            const isSelected = row.getIsSelected();
            const isActive = row.original.id === activeIssueId;
            const priority = row.original.priority;
            const isDragging = row.original.id === dragId;
            const isDropTarget = row.original.id === dropTargetId && dropTargetId !== dragId;

            return (
              <div
                key={row.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                role="row"
                aria-rowindex={virtualRow.index + 2}
                aria-selected={isSelected}
                aria-busy={isTemp}
                className={cn(
                  'absolute left-0 top-0 flex w-full items-center border-b border-border/30 px-3 transition-all duration-150 cursor-pointer',
                  priority === 'urgent' && 'bg-red-50/50 dark:bg-red-950/15',
                  priority === 'high' && 'bg-orange-50/50 dark:bg-orange-950/15',
                  priority === 'medium' && 'bg-amber-50/40 dark:bg-yellow-950/15',
                  priority === 'low' && 'bg-blue-50/40 dark:bg-blue-950/15',
                  'hover:bg-accent/60',
                  isSelected && 'bg-primary/5',
                  isActive && 'bg-primary/8 border-l-[3px] border-l-primary',
                  isFocused && 'ring-1 ring-primary/20 rounded-md z-10',
                  isTemp && 'pointer-events-none opacity-70',
                  isDragging && 'opacity-30',
                  isDropTarget && 'border-t-2 border-t-primary',
                )}
                draggable={isManualSort && !isTemp}
                style={{
                  height: '40px',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => {
                  if (!isTemp) onRowClick(row.original.id);
                }}
                onDoubleClick={() => {
                  if (!isTemp) onRowDoubleClick(row.original.id);
                }}
                onDragStart={isManualSort ? (e) => handleDragStart(e, row.original.id) : undefined}
                onDragEnd={isManualSort ? handleDragEnd : undefined}
                onDragOver={isManualSort ? (e) => handleDragOver(e, row.original.id) : undefined}
                onDrop={isManualSort ? (e) => handleDrop(e, row.original.id) : undefined}
              >
                {/* Drag handle */}
                {isManualSort && (
                  <div
                    className="w-[28px] flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    role="gridcell"
                    className={cn('flex items-center', colClass(cell.column.id))}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Scroll sentinel */}
        {hasNextPage && <div ref={sentinelRef} className="h-10" />}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────────────────────

function IssueListSkeleton() {
  return (
    <div
      className="rounded-xl bg-card shadow-sm ring-1 ring-border/50"
      aria-busy="true"
      aria-label="이슈 목록 로딩 중"
    >
      <div className="flex h-9 items-center gap-2 border-b border-border/40 px-3">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
        <div className="flex-1" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex h-10 items-center gap-2 border-b border-border/30 px-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-[70px]" />
          <div className="flex flex-1 items-center">
            <Skeleton className="h-4" style={{ width: `${40 + Math.random() * 40}%` }} />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
