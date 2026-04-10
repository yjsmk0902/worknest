import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { cn } from '@worknest/ui';
import type { IssueOutput, IssueStatusOutput } from '@worknest/shared';
import { KanbanCard } from './kanban-card';
import { QuickAdd } from '../quick-add';

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
  const overCardInThisColumn = overCardId
    ? issues.some((i) => i.id === overCardId)
    : false;

  // Show placeholder at the end if dragging over column (not a specific card)
  const showEndPlaceholder =
    activeId && isOver && !overCardInThisColumn && !issues.some((i) => i.id === activeId && issues.length === 1);

  return (
    <div
      className={cn(
        'flex flex-col min-w-[360px] max-w-[420px] w-[360px] shrink-0 rounded-xl bg-muted/40 h-full',
        isOver && 'ring-2 ring-primary/20 bg-primary/5',
      )}
    >
      {/* Column header */}
      <div className="flex h-10 items-center gap-2 px-3">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span className="text-sm font-medium text-foreground truncate">
          {status.name}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {count}
        </span>
      </div>

      {/* Card area */}
      <div
        ref={setNodeRef}
        role="list"
        aria-label={`${status.name} 컬럼, ${count}개 이슈`}
        className="flex-1 overflow-y-auto px-2 py-1 min-h-[100px]"
      >
        {issues.length === 0 && !showQuickAdd && !showEndPlaceholder && (
          <div className="flex flex-1 items-center justify-center min-h-[80px]">
            <span className="text-sm text-muted-foreground">
              이슈 없음
            </span>
          </div>
        )}

        {issues.map((issue) => {
          const isBeingDragged = issue.id === activeId;
          const isDropTarget = issue.id === overCardId;

          return (
            <div key={issue.id}>
              {/* Placeholder before this card */}
              {isDropTarget && !isBeingDragged && (
                <div className="mb-2 h-[140px] rounded-xl border-2 border-dashed border-primary/30 bg-primary/5" />
              )}
              <div className={cn('mb-2', isBeingDragged && 'opacity-0 pointer-events-none')}>
                <KanbanCard
                  issue={issue}
                  projectPrefix={projectPrefix}
                  onClick={onCardClick}
                />
              </div>
            </div>
          );
        })}

        {/* Placeholder at end of column */}
        {showEndPlaceholder && (
          <div className="mb-2 h-[140px] rounded-xl border-2 border-dashed border-primary/30 bg-primary/5" />
        )}
      </div>

      {/* Quick Add at bottom */}
      <div className="mt-auto border-t border-border p-2">
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
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label={`${status.name}에 이슈 추가`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
