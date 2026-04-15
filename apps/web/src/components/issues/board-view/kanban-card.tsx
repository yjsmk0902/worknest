import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { IssueOutput } from '@worknest/shared';
import { cn } from '@worknest/ui';
import { Avatar } from '@worknest/ui';
import { BookOpen, Bug, CheckCircle, type LucideIcon, Rocket } from 'lucide-react';
import { PRIORITY_CONFIG, type Priority } from '../../../lib/issue-constants';

const TYPE_ICONS: Record<string, LucideIcon> = {
  'check-circle': CheckCircle,
  bug: Bug,
  'book-open': BookOpen,
  rocket: Rocket,
};

interface KanbanCardProps {
  issue: IssueOutput;
  projectPrefix: string;
  onClick: (issueId: string) => void;
  isDragOverlay?: boolean;
}

export function KanbanCard({
  issue,
  projectPrefix,
  onClick,
  isDragOverlay = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: issue.id,
    disabled: isDragOverlay,
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: issue.id,
    disabled: isDragOverlay,
  });

  // Combine both refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  // Don't apply transform to original card — it's hidden during drag
  // and DragOverlay handles the visual feedback
  const style = undefined;

  const isTemp = issue.id.startsWith('temp-');
  const issueKey = isTemp ? '...' : `${projectPrefix}-${issue.sequenceId}`;

  const priorityConfig = PRIORITY_CONFIG[issue.priority as Priority] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = priorityConfig.icon;
  const showPriority = issue.priority !== 'none';

  const startInfo = formatCardDate(issue.startDate);
  const dueInfo = getDueInfo(issue.dueDate);

  // Label dots (max 3)
  const labels = issue.labels?.slice(0, 3) ?? [];

  // Assignees (max 2)
  const assignees = issue.assignees?.slice(0, 2) ?? [];
  const extraAssignees = (issue.assignees?.length ?? 0) - 2;

  const TypeIcon = issue.type ? TYPE_ICONS[issue.type.icon] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-grabbed={isDragging}
      aria-label={`${issueKey} ${issue.title}`}
      aria-roledescription="드래그 가능한 이슈 카드"
      onClick={(e) => {
        if (!isDragging && !isTemp) {
          e.stopPropagation();
          onClick(issue.id);
        }
      }}
      className={cn(
        'flex flex-col rounded-xl p-3.5 h-[140px] cursor-grab',
        'shadow-sm ring-1 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        issue.priority === 'urgent' &&
          'bg-red-50 ring-red-200/60 dark:bg-red-950/30 dark:ring-red-800/40',
        issue.priority === 'high' &&
          'bg-orange-50 ring-orange-200/60 dark:bg-orange-950/30 dark:ring-orange-800/40',
        issue.priority === 'medium' &&
          'bg-amber-50 ring-amber-200/60 dark:bg-yellow-950/30 dark:ring-yellow-800/40',
        issue.priority === 'low' &&
          'bg-blue-50 ring-blue-200/60 dark:bg-blue-950/30 dark:ring-blue-800/40',
        (issue.priority === 'none' || !issue.priority) && 'bg-card ring-border/50',
        isDragging && 'opacity-0 pointer-events-none',
        isTemp && 'pointer-events-none opacity-70',
      )}
    >
      {/* Top row: key + type + labels + priority */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-muted-foreground shrink-0">{issueKey}</span>
        {TypeIcon && (
          <TypeIcon className="h-3.5 w-3.5 shrink-0" style={{ color: issue.type?.color }} />
        )}
        {labels.length > 0 && (
          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
            {labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-none shrink-0"
                style={{
                  backgroundColor: `${l.label.color}20`,
                  color: l.label.color,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: l.label.color }}
                />
                {l.label.name}
              </span>
            ))}
          </div>
        )}
        {showPriority && (
          <PriorityIcon className={cn('h-3.5 w-3.5 ml-auto shrink-0', priorityConfig.color)} />
        )}
      </div>

      {/* Title */}
      <p className="mt-1 text-sm font-medium line-clamp-2">{issue.title}</p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom row: dates + cycle + assignees */}
      <div className="flex items-center gap-2 mt-1.5">
        <span
          className={cn(
            'text-xs shrink-0',
            dueInfo?.isOverdue && 'text-destructive font-medium',
            dueInfo?.isSoon && !dueInfo?.isOverdue && 'text-orange-500',
            (!dueInfo || (!dueInfo.isOverdue && !dueInfo.isSoon)) && 'text-muted-foreground',
          )}
        >
          {startInfo && dueInfo
            ? `${startInfo} → ${dueInfo.label}`
            : startInfo
              ? `${startInfo} →`
              : dueInfo
                ? `→ ${dueInfo.label}`
                : '-'}
        </span>

        <div className="flex items-center gap-1.5 ml-auto min-w-0">
          {issue.cycle && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none shrink-0',
                issue.cycle.status === 'active'
                  ? 'bg-primary/10 text-primary'
                  : issue.cycle.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  issue.cycle.status === 'active'
                    ? 'bg-primary'
                    : issue.cycle.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground',
                )}
              />
              {issue.cycle.name}
            </span>
          )}

          {assignees.length > 0 ? (
            <>
              <Avatar
                src={assignees[0].user.avatarUrl}
                fallback={assignees[0].user.name}
                className="w-5 h-5 text-[10px] shrink-0"
              />
              <span className="text-xs text-muted-foreground truncate">
                {assignees[0].user.name}
              </span>
              {extraAssignees > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  +{extraAssignees}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground/50">담당자 없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Date helpers ─────────────────────────────────────────────────────

function formatCardDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ── Due date helper ───────────────────────────────────────────────────

interface DueInfo {
  label: string;
  isOverdue: boolean;
  isSoon?: boolean;
}

function getDueInfo(dueDate: string | null): DueInfo | null {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const label = due.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });

  if (diffDays < 0) {
    return { label, isOverdue: true };
  }
  if (diffDays <= 3) {
    return { label, isOverdue: false, isSoon: true };
  }
  return { label, isOverdue: false };
}
