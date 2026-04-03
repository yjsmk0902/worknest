import { X } from 'lucide-react';
import { cn } from '@worknest/ui';
import type { ActiveFilter } from './use-issue-filters';
import { getFieldMeta } from './use-issue-filters';
import { PRIORITY_CONFIG, type Priority } from '../../../lib/issue-constants';
import type { IssueStatusOutput, IssueTypeOutput } from '@worknest/shared';

// ── Types ───────────────────────────────────────────────────────────────

interface LabelOutput {
  id: string;
  name: string;
  color: string;
}

interface MemberOutput {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface FilterChipProps {
  filter: ActiveFilter;
  statuses: IssueStatusOutput[];
  types: IssueTypeOutput[];
  members: MemberOutput[];
  labels: LabelOutput[];
  onEdit: () => void;
  onRemove: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function resolveValueDisplay(
  filter: ActiveFilter,
  statuses: IssueStatusOutput[],
  types: IssueTypeOutput[],
  members: MemberOutput[],
  labels: LabelOutput[],
): string {
  if (
    filter.operator === 'is_empty' ||
    filter.operator === 'is_not_empty'
  ) {
    return '없음';
  }

  const values = Array.isArray(filter.value)
    ? filter.value
    : filter.value
      ? [filter.value]
      : [];

  if (values.length === 0) return '';

  switch (filter.field) {
    case 'statusId': {
      const names = values
        .map((id) => statuses.find((s) => s.id === id)?.name ?? id)
        .join(', ');
      return names;
    }
    case 'typeId': {
      const names = values
        .map((id) => types.find((t) => t.id === id)?.name ?? id)
        .join(', ');
      return names;
    }
    case 'priority': {
      const names = values
        .map(
          (p) => PRIORITY_CONFIG[p as Priority]?.label ?? p,
        )
        .join(', ');
      return names;
    }
    case 'assigneeId': {
      const names = values
        .map(
          (id) =>
            members.find((m) => m.user.id === id)?.user.name ?? id,
        )
        .join(', ');
      return names;
    }
    case 'labelId': {
      const names = values
        .map((id) => labels.find((l) => l.id === id)?.name ?? id)
        .join(', ');
      return names;
    }
    case 'dueDate': {
      if (filter.operator === 'before') return `~${values[0]}`;
      if (filter.operator === 'after') return `${values[0]}~`;
      return values.join(' ~ ');
    }
    case 'title': {
      return `"${values[0]}"`;
    }
    default:
      return values.join(', ');
  }
}

function getOperatorDisplay(operator: string): string | null {
  switch (operator) {
    case 'is':
    case 'includes':
    case 'contains':
    case 'before':
    case 'after':
      return null; // hide default operators
    case 'is_not':
      return 'is not';
    case 'excludes':
      return 'excludes';
    case 'is_empty':
      return null; // value display handles this
    case 'is_not_empty':
      return 'is not empty';
    default:
      return operator;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export function FilterChip({
  filter,
  statuses,
  types,
  members,
  labels,
  onEdit,
  onRemove,
}: FilterChipProps) {
  const fieldMeta = getFieldMeta(filter.field);
  const fieldLabel = fieldMeta?.label ?? filter.field;
  const operatorDisplay = getOperatorDisplay(filter.operator);
  const valueDisplay = resolveValueDisplay(
    filter,
    statuses,
    types,
    members,
    labels,
  );

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 h-7',
        'cursor-pointer hover:bg-secondary/80 transition-colors',
      )}
      role="button"
      aria-label={`${fieldLabel}: ${valueDisplay}`}
    >
      <span className="text-xs font-medium text-muted-foreground">
        {fieldLabel}:
      </span>
      {operatorDisplay && (
        <span className="text-xs text-muted-foreground">
          {operatorDisplay}
        </span>
      )}
      <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
        {valueDisplay}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
        aria-label={`${fieldLabel} 필터 제거`}
      >
        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </button>
    </button>
  );
}
