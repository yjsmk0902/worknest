import { useEffect, useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type RowSelectionState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, CirclePlus, SearchX } from 'lucide-react';
import { Button, Skeleton } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { EmptyState } from '../../empty-state';
import { createIssueColumns } from './columns';
import type { IssueOutput } from '@worknest/shared';

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
  onShowQuickAdd: () => void;
  hasFilters: boolean;
  onClearFilters?: () => void;
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
  onShowQuickAdd,
  hasFilters,
  onClearFilters,
}: IssueListTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => createIssueColumns(projectPrefix, projectId),
    [projectPrefix, projectId],
  );

  const table = useReactTable({
    data: issues,
    columns,
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater;
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
          action={
            onClearFilters
              ? { label: '필터 초기화', onClick: onClearFilters }
              : undefined
          }
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
    <div className="rounded-lg border border-border" role="grid" aria-label="이슈 목록">
      {/* Header */}
      <div
        className="flex h-8 items-center border-b border-border bg-muted/50 px-3"
        role="row"
        aria-rowindex={1}
      >
        {table.getHeaderGroups().map((headerGroup) =>
          headerGroup.headers.map((header) => (
            <div
              key={header.id}
              role="columnheader"
              className={cn(
                'flex items-center',
                header.id === 'title' ? 'flex-1 min-w-0' : '',
                header.id === 'select' ? 'w-[40px] justify-center' : '',
                header.id === 'priority' ? 'w-[40px]' : '',
                header.id === 'issueKey' ? 'w-[80px]' : '',
                header.id === 'status' ? 'w-[120px]' : '',
                header.id === 'assignee' ? 'w-[80px]' : '',
                header.id === 'dueDate' ? 'w-[100px]' : '',
              )}
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
            </div>
          )),
        )}
      </div>

      {/* Virtual scrolling body */}
      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 220px)' }}
      >
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
                  'absolute left-0 top-0 flex w-full items-center border-b border-border/50 px-3 transition-colors cursor-pointer',
                  'hover:bg-accent/50',
                  isSelected && 'bg-primary/5',
                  isFocused && 'ring-1 ring-primary/30 rounded-sm z-10',
                  isTemp && 'pointer-events-none opacity-70',
                )}
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
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    role="gridcell"
                    className={cn(
                      'flex items-center',
                      cell.column.id === 'title'
                        ? 'flex-1 min-w-0 overflow-hidden'
                        : '',
                      cell.column.id === 'select'
                        ? 'w-[40px] justify-center'
                        : '',
                      cell.column.id === 'priority'
                        ? 'w-[40px]'
                        : '',
                      cell.column.id === 'issueKey'
                        ? 'w-[80px]'
                        : '',
                      cell.column.id === 'status'
                        ? 'w-[120px]'
                        : '',
                      cell.column.id === 'assignee'
                        ? 'w-[80px]'
                        : '',
                      cell.column.id === 'dueDate'
                        ? 'w-[100px]'
                        : '',
                    )}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Scroll sentinel */}
        {hasNextPage && (
          <div ref={sentinelRef} className="h-10" />
        )}

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
      className="rounded-lg border border-border"
      aria-busy="true"
      aria-label="이슈 목록 로딩 중"
    >
      <div className="flex h-8 items-center gap-2 border-b border-border bg-muted/50 px-3">
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
          className="flex h-10 items-center gap-2 border-b border-border/50 px-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-[70px]" />
          <div className="flex flex-1 items-center">
            <Skeleton
              className="h-4"
              style={{ width: `${40 + Math.random() * 40}%` }}
            />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
