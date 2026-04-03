import { cn } from '@worknest/ui';
import { Avatar } from '@worknest/ui';
import type { IssueOutput } from '@worknest/shared';
import { PRIORITY_CONFIG, type Priority } from '../../../lib/issue-constants';

interface DragOverlayCardProps {
  issue: IssueOutput;
  projectPrefix: string;
}

export function DragOverlayCard({
  issue,
  projectPrefix,
}: DragOverlayCardProps) {
  const issueKey = `${projectPrefix}-${issue.sequenceId}`;

  const priorityConfig =
    PRIORITY_CONFIG[issue.priority as Priority] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = priorityConfig.icon;
  const showPriority = issue.priority !== 'none';

  const dueInfo = getDueInfo(issue.dueDate);
  const labels = issue.labels?.slice(0, 3) ?? [];
  const assignees = issue.assignees?.slice(0, 2) ?? [];
  const extraAssignees = (issue.assignees?.length ?? 0) - 2;

  const hasMetaRow =
    showPriority ||
    assignees.length > 0 ||
    labels.length > 0 ||
    dueInfo !== null;

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card p-3',
        'opacity-85 shadow-lg scale-[1.02] rotate-[1deg] cursor-grabbing',
        'min-w-[280px] max-w-[320px]',
      )}
    >
      {/* Issue key */}
      <span className="text-xs font-mono text-muted-foreground">
        {issueKey}
      </span>

      {/* Title */}
      <p className="mt-1 text-sm font-medium line-clamp-2">
        {issue.title}
      </p>

      {/* Meta row */}
      {hasMetaRow && (
        <div className="flex items-center gap-2 mt-2">
          {showPriority && (
            <PriorityIcon
              className={cn('w-4 h-4', priorityConfig.color)}
            />
          )}

          {labels.length > 0 && (
            <div className="flex items-center gap-1">
              {labels.map((l) => (
                <span
                  key={l.id}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: l.label.color }}
                />
              ))}
            </div>
          )}

          {dueInfo && (
            <span
              className={cn(
                'text-xs',
                dueInfo.isOverdue && 'text-destructive font-medium',
                !dueInfo.isOverdue && 'text-orange-500',
              )}
            >
              {dueInfo.label}
            </span>
          )}

          {assignees.length > 0 && (
            <div className="flex items-center ml-auto">
              {assignees.map((a, i) => (
                <Avatar
                  key={a.id}
                  src={a.user.avatarUrl}
                  fallback={a.user.name}
                  className={cn(
                    'w-5 h-5 text-[10px]',
                    i > 0 && '-ml-1',
                  )}
                />
              ))}
              {extraAssignees > 0 && (
                <span className="flex items-center justify-center w-5 h-5 -ml-1 rounded-full bg-muted text-xs text-muted-foreground">
                  +{extraAssignees}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Due date helper ───────────────────────────────────────────────────

interface DueInfo {
  label: string;
  isOverdue: boolean;
}

function getDueInfo(dueDate: string | null): DueInfo | null {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: new Date(dueDate).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
      }),
      isOverdue: true,
    };
  }

  if (diffDays <= 3) {
    return {
      label: new Date(dueDate).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
      }),
      isOverdue: false,
    };
  }

  return null;
}
