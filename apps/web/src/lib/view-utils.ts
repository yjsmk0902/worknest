import type { ViewOutput, FilterCondition } from '@worknest/shared';
import type { IssueSearchParams } from '../components/issues/filter-builder/use-issue-filters';

// ── Sort field display labels ──────────────────────────────────────────

const SORT_FIELD_LABELS: Record<string, string> = {
  created_at: '생성일',
  updated_at: '수정일',
  priority: '우선순위',
  due_date: '마감일',
  manual: '수동',
};

const SORT_DIRECTION_LABELS: Record<string, string> = {
  asc: '오름차순',
  desc: '내림차순',
};

export function getSortDisplayText(
  sort: ViewOutput['sort'],
): string {
  if (!sort) return '기본 정렬';
  const fieldLabel = SORT_FIELD_LABELS[sort.field] ?? sort.field;
  const dirLabel = SORT_DIRECTION_LABELS[sort.direction] ?? sort.direction;
  return `${fieldLabel} ${dirLabel}`;
}

// ── Convert View filters to URL search params ──────────────────────────

export function viewToSearchParams(
  view: Pick<ViewOutput, 'filters' | 'sort'>,
): IssueSearchParams {
  const params: IssueSearchParams = {};

  for (const condition of view.filters) {
    const vals = Array.isArray(condition.value)
      ? condition.value.join(',')
      : condition.value;

    switch (condition.field) {
      case 'statusId':
        if (condition.operator === 'is_not') params.statusIdNot = vals;
        else params.statusId = vals;
        break;
      case 'typeId':
        if (condition.operator === 'is_not') params.typeIdNot = vals;
        else params.typeId = vals;
        break;
      case 'priority':
        if (condition.operator === 'is_not') params.priorityNot = vals;
        else params.priority = vals;
        break;
      case 'assigneeId':
        if (condition.operator === 'is_empty') params.assigneeEmpty = true;
        else if (condition.operator === 'is_not')
          params.assigneeIdNot = vals;
        else params.assigneeId = vals;
        break;
      case 'labelId':
        if (condition.operator === 'excludes') params.labelIdNot = vals;
        else params.labelId = vals;
        break;
      case 'dueDate':
        if (condition.operator === 'is_empty') params.dueEmpty = true;
        else if (condition.operator === 'before') params.dueBefore = vals;
        else if (condition.operator === 'after') params.dueAfter = vals;
        break;
      case 'title':
        params.title = vals;
        break;
    }
  }

  if (view.sort) {
    params.sort = view.sort.field;
    params.order = view.sort.direction;
  }

  return params;
}

// ── Convert current URL search params / active filters to FilterCondition[] ──

export function activeFiltersToConditions(
  filters: { field: string; operator: string; value?: string | string[] }[],
): FilterCondition[] {
  return filters.map((f) => ({
    field: f.field as FilterCondition['field'],
    operator: f.operator as FilterCondition['operator'],
    value: f.value,
  }));
}

// ── View type display label ────────────────────────────────────────────

export function getViewTypeLabel(type: 'list' | 'board' | 'gantt'): string {
  if (type === 'board') return '보드';
  if (type === 'gantt') return '간트';
  return '리스트';
}
