import { useDroppable } from '@dnd-kit/core';
import type { IssueOutput, IssueStatusOutput } from '@worknest/shared';
import { cn } from '@worknest/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CategoryGlyph, type GroupCategory } from '../../../lib/status-category-config';
import { QuickAdd } from '../quick-add';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  status: IssueStatusOutput;
  issues: IssueOutput[];
  count: number;
  projectId: string;
  projectPrefix: string;
  onCardClick: (issueId: string) => void;
  isOver?: boolean;
  activeId?: string | null;
  overCardId?: string | null;
  dropAbove?: boolean;
}

export function KanbanColumn({
  status,
  issues,
  count,
  projectId,
  projectPrefix,
  onCardClick,
  isOver,
  activeId,
  overCardId,
  dropAbove = true,
}: KanbanColumnProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const { setNodeRef } = useDroppable({
    id: `column-${status.id}`,
    data: {
      type: 'column',
      statusId: status.id,
    },
  });

  // Check if the over card is in this column
  const overCardInThisColumn = overCardId ? issues.some((i) => i.id === overCardId) : false;

  // Show placeholder at the end if dragging over column (not a specific card)
  const showEndPlaceholder =
    activeId &&
    isOver &&
    !overCardInThisColumn &&
    !issues.some((i) => i.id === activeId && issues.length === 1);

  return (
    <div
      className={cn(
        'flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--panel)]',
        isOver && 'ring-2 ring-[color:var(--accent-soft)]',
      )}
    >
      {/* Column header */}
      <div className="flex h-11 items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 text-[13px] font-medium text-[color:var(--fg-1)]">
        <CategoryGlyph
          category={status.category as GroupCategory | undefined}
          color={status.color}
          size={13}
        />
        <span className="truncate">{status.name}</span>
        <span className="ml-auto inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md bg-[color:var(--bg-3)] px-[6px] font-mono text-[11px] text-[color:var(--fg-2)]">
          {count}
        </span>
      </div>

      {/* Card area */}
      <div
        ref={setNodeRef}
        role="list"
        aria-label={`${status.name} 컬럼, ${count}개 이슈`}
        className="flex min-h-0 flex-1 flex-col gap-[6px] overflow-y-auto p-2"
      >
        {issues.length === 0 && !showQuickAdd && !showEndPlaceholder && (
          <div className="flex flex-1 items-center justify-center py-5">
            <span className="text-[12px] text-[color:var(--fg-faint)]">이슈 없음</span>
          </div>
        )}

        {issues
          .filter((issue) => issue.id !== activeId)
          .map((issue) => {
            const isDropTarget = issue.id === overCardId;

            return (
              <div key={issue.id} className="relative">
                {isDropTarget && dropAbove && (
                  <div className="pointer-events-none absolute -top-[4px] left-0 right-0 h-[3px] rounded-full bg-[color:var(--accent-bg)]" />
                )}
                <KanbanCard issue={issue} projectPrefix={projectPrefix} onClick={onCardClick} />
                {isDropTarget && !dropAbove && (
                  <div className="pointer-events-none absolute -bottom-[4px] left-0 right-0 h-[3px] rounded-full bg-[color:var(--accent-bg)]" />
                )}
              </div>
            );
          })}

        {showEndPlaceholder && (
          <div className="pointer-events-none h-[3px] rounded-full bg-[color:var(--accent-bg)]" />
        )}
      </div>

      {/* Quick Add at bottom */}
      <div className="mt-auto border-t border-[color:var(--border-subtle)] p-2">
        {showQuickAdd ? (
          <QuickAdd
            projectId={projectId}
            defaultStatusId={status.id}
            onClose={() => setShowQuickAdd(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowQuickAdd(true)}
            className="flex w-full items-center gap-[6px] rounded-md px-2 py-1.5 text-[12px] text-[color:var(--fg-faint)] transition-colors hover:bg-[color:var(--bg-hover)] hover:text-foreground"
            aria-label={`${status.name}에 이슈 추가`}
          >
            <Plus className="h-[11px] w-[11px]" /> 이슈 추가
          </button>
        )}
      </div>
    </div>
  );
}
