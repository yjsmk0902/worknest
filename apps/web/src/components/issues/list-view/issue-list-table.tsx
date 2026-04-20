import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RowSelectionState } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { generateKeyBetween } from '@worknest/shared';
import type { IssueOutput } from '@worknest/shared';
import { Skeleton, toast } from '@worknest/ui';
import { CirclePlus, Loader2, SearchX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { EmptyState } from '../../empty-state';
import { IssueRow } from './grouped-issues-list';

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
  selectionMode?: boolean;
}

function safeGenerateKey(a: string | null, b: string | null): string {
  try {
    if (a != null && b != null && a >= b) return generateKeyBetween(a, null);
    return generateKeyBetween(a, b);
  } catch {
    return generateKeyBetween(a, null);
  }
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
  activeIssueId,
  onShowQuickAdd,
  hasFilters,
  onClearFilters,
  isManualSort = false,
  selectionMode = false,
}: IssueListTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < issues.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, issues.length, virtualizer]);

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

  const handleDragStart = useCallback((e: React.DragEvent, issueId: string) => {
    setDragId(issueId);
    e.dataTransfer.effectAllowed = 'move';
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

  const toggleRow = useCallback(
    (issueId: string) => {
      const next = { ...rowSelection };
      if (next[issueId]) delete next[issueId];
      else next[issueId] = true;
      onRowSelectionChange(next);
    },
    [rowSelection, onRowSelectionChange],
  );

  if (isLoading) {
    return <IssueListSkeleton />;
  }

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
        action={{ label: '이슈 만들기', onClick: onShowQuickAdd }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="이슈 목록">
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const issue = issues[virtualRow.index];
            if (!issue) return null;
            const isTemp = issue.id.startsWith('temp-');
            const isDragging = issue.id === dragId;
            const isDropTarget = issue.id === dropTargetId && dropTargetId !== dragId;

            return (
              <div
                key={issue.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <IssueRow
                  issue={issue}
                  projectPrefix={projectPrefix}
                  active={activeIssueId === issue.id}
                  onClick={() =>
                    selectionMode ? toggleRow(issue.id) : !isTemp && onRowClick(issue.id)
                  }
                  selectionMode={selectionMode}
                  selected={!!rowSelection[issue.id]}
                  onToggleSelect={() => toggleRow(issue.id)}
                  draggable={isManualSort && !isTemp}
                  onDragStart={(e) => handleDragStart(e, issue.id)}
                  onDragOver={(e) => handleDragOver(e, issue.id)}
                  onDrop={(e) => handleDrop(e, issue.id)}
                  onDragEnd={handleDragEnd}
                  isDragging={isDragging}
                  isDropTarget={isDropTarget}
                />
              </div>
            );
          })}
        </div>

        {hasNextPage && <div ref={sentinelRef} className="h-10" />}

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
    <div className="flex flex-col" aria-busy="true" aria-label="이슈 목록 로딩 중">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex h-[44px] items-center gap-3 border-b border-[color:var(--border-subtle)] px-4"
        >
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-[60px]" />
          <Skeleton className="h-3 w-3 rounded-full" />
          <div className="flex flex-1 items-center">
            <Skeleton className="h-3" style={{ width: `${40 + Math.random() * 40}%` }} />
          </div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}
