import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { FilterField, FilterOperator } from '@worknest/shared';

// ── Types ───────────────────────────────────────────────────────────────

export interface ActiveFilter {
  field: FilterField;
  operator: FilterOperator;
  value?: string | string[];
}

export interface IssueSearchParams {
  statusId?: string;
  statusIdNot?: string;
  typeId?: string;
  typeIdNot?: string;
  priority?: string;
  priorityNot?: string;
  assigneeId?: string;
  assigneeIdNot?: string;
  assigneeEmpty?: boolean;
  labelId?: string;
  labelIdNot?: string;
  dueBefore?: string;
  dueAfter?: string;
  dueEmpty?: boolean;
  title?: string;
  sort?: string;
  order?: string;
}

// ── Field metadata ──────────────────────────────────────────────────────

export const FILTER_FIELDS: {
  field: FilterField;
  label: string;
  operators: FilterOperator[];
  defaultOperator: FilterOperator;
  valueType: 'multi-select' | 'date' | 'text';
}[] = [
  {
    field: 'statusId',
    label: '상태',
    operators: ['is', 'is_not'],
    defaultOperator: 'is',
    valueType: 'multi-select',
  },
  {
    field: 'typeId',
    label: '타입',
    operators: ['is', 'is_not'],
    defaultOperator: 'is',
    valueType: 'multi-select',
  },
  {
    field: 'priority',
    label: '우선순위',
    operators: ['is', 'is_not'],
    defaultOperator: 'is',
    valueType: 'multi-select',
  },
  {
    field: 'assigneeId',
    label: '담당자',
    operators: ['is', 'is_not', 'is_empty'],
    defaultOperator: 'is',
    valueType: 'multi-select',
  },
  {
    field: 'labelId',
    label: '라벨',
    operators: ['includes', 'excludes'],
    defaultOperator: 'includes',
    valueType: 'multi-select',
  },
  {
    field: 'dueDate',
    label: '마감일',
    operators: ['before', 'after', 'is_empty'],
    defaultOperator: 'before',
    valueType: 'date',
  },
  {
    field: 'title',
    label: '제목',
    operators: ['contains'],
    defaultOperator: 'contains',
    valueType: 'text',
  },
];

export function getFieldMeta(field: FilterField) {
  return FILTER_FIELDS.find((f) => f.field === field);
}

// ── URL param helpers ───────────────────────────────────────────────────

function searchToFilters(search: IssueSearchParams): ActiveFilter[] {
  const filters: ActiveFilter[] = [];

  if (search.statusId) {
    filters.push({
      field: 'statusId',
      operator: 'is',
      value: search.statusId.split(','),
    });
  }
  if (search.statusIdNot) {
    filters.push({
      field: 'statusId',
      operator: 'is_not',
      value: search.statusIdNot.split(','),
    });
  }
  if (search.typeId) {
    filters.push({
      field: 'typeId',
      operator: 'is',
      value: search.typeId.split(','),
    });
  }
  if (search.typeIdNot) {
    filters.push({
      field: 'typeId',
      operator: 'is_not',
      value: search.typeIdNot.split(','),
    });
  }
  if (search.priority) {
    filters.push({
      field: 'priority',
      operator: 'is',
      value: search.priority.split(','),
    });
  }
  if (search.priorityNot) {
    filters.push({
      field: 'priority',
      operator: 'is_not',
      value: search.priorityNot.split(','),
    });
  }
  if (search.assigneeEmpty) {
    filters.push({
      field: 'assigneeId',
      operator: 'is_empty',
    });
  } else if (search.assigneeId) {
    filters.push({
      field: 'assigneeId',
      operator: 'is',
      value: search.assigneeId.split(','),
    });
  } else if (search.assigneeIdNot) {
    filters.push({
      field: 'assigneeId',
      operator: 'is_not',
      value: search.assigneeIdNot.split(','),
    });
  }
  if (search.labelId) {
    filters.push({
      field: 'labelId',
      operator: 'includes',
      value: search.labelId.split(','),
    });
  }
  if (search.labelIdNot) {
    filters.push({
      field: 'labelId',
      operator: 'excludes',
      value: search.labelIdNot.split(','),
    });
  }
  if (search.dueEmpty) {
    filters.push({
      field: 'dueDate',
      operator: 'is_empty',
    });
  } else if (search.dueBefore) {
    filters.push({
      field: 'dueDate',
      operator: 'before',
      value: search.dueBefore,
    });
  } else if (search.dueAfter) {
    filters.push({
      field: 'dueDate',
      operator: 'after',
      value: search.dueAfter,
    });
  }
  if (search.title) {
    filters.push({
      field: 'title',
      operator: 'contains',
      value: search.title,
    });
  }

  return filters;
}

function filtersToSearch(
  filters: ActiveFilter[],
  currentSearch: IssueSearchParams,
): IssueSearchParams {
  // Start with sort/order from current search, strip all filter params
  const next: IssueSearchParams = {};
  if (currentSearch.sort) next.sort = currentSearch.sort;
  if (currentSearch.order) next.order = currentSearch.order;

  for (const f of filters) {
    const vals = Array.isArray(f.value) ? f.value.join(',') : f.value;

    switch (f.field) {
      case 'statusId':
        if (f.operator === 'is_not') next.statusIdNot = vals;
        else next.statusId = vals;
        break;
      case 'typeId':
        if (f.operator === 'is_not') next.typeIdNot = vals;
        else next.typeId = vals;
        break;
      case 'priority':
        if (f.operator === 'is_not') next.priorityNot = vals;
        else next.priority = vals;
        break;
      case 'assigneeId':
        if (f.operator === 'is_empty') next.assigneeEmpty = true;
        else if (f.operator === 'is_not') next.assigneeIdNot = vals;
        else next.assigneeId = vals;
        break;
      case 'labelId':
        if (f.operator === 'excludes') next.labelIdNot = vals;
        else next.labelId = vals;
        break;
      case 'dueDate':
        if (f.operator === 'is_empty') next.dueEmpty = true;
        else if (f.operator === 'before') next.dueBefore = vals;
        else if (f.operator === 'after') next.dueAfter = vals;
        break;
      case 'title':
        next.title = vals;
        break;
    }
  }

  return next;
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useIssueFilters() {
  const search = useSearch({
    strict: false,
  }) as IssueSearchParams;
  const navigate = useNavigate();

  const filters = useMemo(() => searchToFilters(search), [search]);

  const setFilters = useCallback(
    (nextFilters: ActiveFilter[]) => {
      const nextSearch = filtersToSearch(nextFilters, search);
      navigate({
        search: nextSearch as Record<string, unknown>,
        replace: true,
      });
    },
    [navigate, search],
  );

  const addFilter = useCallback(
    (filter: ActiveFilter) => {
      // Replace if same field already exists
      const existing = filters.filter((f) => f.field !== filter.field);
      setFilters([...existing, filter]);
    },
    [filters, setFilters],
  );

  const removeFilter = useCallback(
    (field: FilterField) => {
      setFilters(filters.filter((f) => f.field !== field));
    },
    [filters, setFilters],
  );

  const updateFilter = useCallback(
    (field: FilterField, update: Partial<ActiveFilter>) => {
      setFilters(
        filters.map((f) => (f.field === field ? { ...f, ...update } : f)),
      );
    },
    [filters, setFilters],
  );

  const clearAllFilters = useCallback(() => {
    setFilters([]);
  }, [setFilters]);

  // Convert filters to API query params format
  const apiParams = useMemo(() => {
    const params: Record<string, string> = {};
    for (const f of filters) {
      const vals = Array.isArray(f.value) ? f.value.join(',') : f.value;
      switch (f.field) {
        case 'statusId':
          if (f.operator === 'is_not') params.statusIdNot = vals ?? '';
          else params.statusId = vals ?? '';
          break;
        case 'typeId':
          if (f.operator === 'is_not') params.typeIdNot = vals ?? '';
          else params.typeId = vals ?? '';
          break;
        case 'priority':
          if (f.operator === 'is_not') params.priorityNot = vals ?? '';
          else params.priority = vals ?? '';
          break;
        case 'assigneeId':
          if (f.operator === 'is_empty') params.assigneeEmpty = 'true';
          else if (f.operator === 'is_not')
            params.assigneeIdNot = vals ?? '';
          else params.assigneeId = vals ?? '';
          break;
        case 'labelId':
          if (f.operator === 'excludes') params.labelIdNot = vals ?? '';
          else params.labelId = vals ?? '';
          break;
        case 'dueDate':
          if (f.operator === 'is_empty') params.dueEmpty = 'true';
          else if (f.operator === 'before') params.dueBefore = vals ?? '';
          else if (f.operator === 'after') params.dueAfter = vals ?? '';
          break;
        case 'title':
          params.title = vals ?? '';
          break;
      }
    }
    if (search.sort) params.sort = search.sort;
    if (search.order) params.order = search.order;
    return params;
  }, [filters, search.sort, search.order]);

  return {
    filters,
    addFilter,
    removeFilter,
    updateFilter,
    clearAllFilters,
    apiParams,
    hasFilters: filters.length > 0,
  };
}
