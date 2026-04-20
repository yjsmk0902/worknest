import { useDroppable } from '@dnd-kit/core';
import type { IssueOutput, IssueStatusOutput } from '@worknest/shared';
import { cn } from '@worknest/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
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
        'flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--panel)]',
        isOver && 'ring-2 ring-[color:var(--accent-soft)]',
      )}
    >
      {/* Column header */}
      <div className="flex h-10 items-center gap-2 border-b border-[color:var(--border-subtle)] px-3 text-[12px] font-medium text-foreground">
        <span
          className="h-[10px] w-[10px] shrink-0 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="truncate">{status.name}</span>
        <span className="ml-auto font-mono text-[11px] text-[color:var(--fg-faint)]">{count}</span>
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

        {issues.map((issue) => {
          const isBeingDragged = issue.id === activeId;
          const isDropTarget = issue.id === overCardId;

          return (
            <div key={issue.id}>
              {isDropTarget && !isBeingDragged && (
                <div className="mb-[6px] h-[120px] rounded-md border-2 border-dashed border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)]/40" />
              )}
              <div className={cn(isBeingDragged && 'pointer-events-none opacity-0')}>
                <KanbanCard issue={issue} projectPrefix={projectPrefix} onClick={onCardClick} />
              </div>
            </div>
          );
        })}

        {showEndPlaceholder && (
          <div className="h-[120px] rounded-md border-2 border-dashed border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)]/40" />
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
