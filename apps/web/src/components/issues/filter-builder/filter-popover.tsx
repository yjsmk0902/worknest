import { useQuery } from '@tanstack/react-query';
import type {
  CycleOutput,
  FilterField,
  FilterOperator,
  IssueStatusOutput,
  IssueTypeOutput,
} from '@worknest/shared';
import { Button, Popover, PopoverContent, PopoverTrigger, Separator } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { Check, ChevronLeft, Filter, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useProjectContext } from '../../../contexts/project-context';
import { type ListResponse, apiClient } from '../../../lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '../../../lib/issue-constants';
import { type ActiveFilter, FILTER_FIELDS } from './use-issue-filters';

// ── Types ───────────────────────────────────────────────────────────────

interface MemberOutput {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface LabelOutput {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

interface FilterPopoverProps {
  /** When editing an existing filter, pass the current filter state */
  editingFilter?: ActiveFilter;
  /** Active filter count for badge display */
  filterCount: number;
  /** Called when a filter is confirmed */
  onApply: (filter: ActiveFilter) => void;
  /** Custom trigger element (for chip editing) */
  trigger?: React.ReactNode;
  /** Control open state externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type Step = 'field' | 'operator' | 'value';

// ── Component ───────────────────────────────────────────────────────────

export function FilterPopover({
  editingFilter,
  filterCount,
  onApply,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: FilterPopoverProps) {
  const { projectId } = useProjectContext();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const [step, setStep] = useState<Step>(editingFilter ? 'value' : 'field');
  const [selectedField, setSelectedField] = useState<FilterField | null>(
    editingFilter?.field ?? null,
  );
  const [selectedOperator, setSelectedOperator] = useState<FilterOperator | null>(
    editingFilter?.operator ?? null,
  );
  const [selectedValues, setSelectedValues] = useState<string[]>(() => {
    if (!editingFilter?.value) return [];
    return Array.isArray(editingFilter.value) ? editingFilter.value : [editingFilter.value];
  });
  const [textValue, setTextValue] = useState(
    editingFilter?.field === 'title' && typeof editingFilter?.value === 'string'
      ? editingFilter.value
      : '',
  );
  const [dateValue, setDateValue] = useState(
    editingFilter?.field === 'dueDate' && typeof editingFilter?.value === 'string'
      ? editingFilter.value
      : '',
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data for value selectors
  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => apiClient.get<IssueStatusOutput[]>(`/projects/${projectId}/statuses`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const typesQuery = useQuery<IssueTypeOutput[]>({
    queryKey: ['projects', projectId, 'types'],
    queryFn: () => apiClient.get<IssueTypeOutput[]>(`/projects/${projectId}/types`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const membersQuery = useQuery<ListResponse<MemberOutput>>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => apiClient.getList<MemberOutput>(`/projects/${projectId}/members`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const labelsQuery = useQuery<LabelOutput[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => apiClient.get<LabelOutput[]>(`/projects/${projectId}/labels`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const cyclesQuery = useQuery<ListResponse<CycleOutput>>({
    queryKey: ['projects', projectId, 'cycles'],
    queryFn: () => apiClient.getList<CycleOutput>(`/projects/${projectId}/cycles`),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const fieldMeta = selectedField ? FILTER_FIELDS.find((f) => f.field === selectedField) : null;

  function reset() {
    if (editingFilter) {
      setStep('value');
      setSelectedField(editingFilter.field);
      setSelectedOperator(editingFilter.operator);
      const vals = editingFilter.value
        ? Array.isArray(editingFilter.value)
          ? editingFilter.value
          : [editingFilter.value]
        : [];
      setSelectedValues(vals);
      setTextValue(
        editingFilter.field === 'title' && typeof editingFilter.value === 'string'
          ? editingFilter.value
          : '',
      );
      setDateValue(
        editingFilter.field === 'dueDate' && typeof editingFilter.value === 'string'
          ? editingFilter.value
          : '',
      );
    } else {
      setStep('field');
      setSelectedField(null);
      setSelectedOperator(null);
      setSelectedValues([]);
      setTextValue('');
      setDateValue('');
    }
    setSearchQuery('');
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen) {
      reset();
    }
  }

  function handleFieldSelect(field: FilterField) {
    setSelectedField(field);
    const meta = FILTER_FIELDS.find((f) => f.field === field);
    if (!meta) return;

    // If only one operator, skip step 2
    if (meta.operators.length === 1) {
      setSelectedOperator(meta.operators[0]);
      // For is_empty-like, skip value too
      if (meta.operators[0] === 'is_empty') {
        onApply({ field, operator: 'is_empty' });
        setOpen(false);
        return;
      }
      setStep('value');
    } else {
      setSelectedOperator(meta.defaultOperator);
      setStep('operator');
    }
  }

  function handleOperatorSelect(op: FilterOperator) {
    setSelectedOperator(op);
    if (op === 'is_empty') {
      onApply({ field: selectedField!, operator: 'is_empty' });
      setOpen(false);
      return;
    }
    setStep('value');
  }

  function handleApply() {
    if (!selectedField || !selectedOperator) return;

    let value: string | string[] | undefined;

    if (fieldMeta?.valueType === 'text') {
      value = textValue.trim();
      if (!value) return;
    } else if (fieldMeta?.valueType === 'date') {
      value = dateValue;
      if (!value) return;
    } else {
      value = selectedValues;
      if (value.length === 0) return;
    }

    onApply({ field: selectedField, operator: selectedOperator, value });
    setOpen(false);
  }

  function toggleValue(val: string) {
    setSelectedValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Filter className="h-4 w-4" />
      <span>필터</span>
      {filterCount > 0 && (
        <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {filterCount}
        </span>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-0">
        {/* Step 1: Field selection */}
        {step === 'field' && (
          <div>
            <div className="px-3 py-2 text-sm font-medium">필터 추가</div>
            <Separator />
            <div className="p-1">
              {FILTER_FIELDS.map((f) => (
                <button
                  key={f.field}
                  type="button"
                  onClick={() => handleFieldSelect(f.field)}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="flex-1 text-left">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Operator selection */}
        {step === 'operator' && fieldMeta && (
          <div>
            <button
              type="button"
              onClick={() => setStep('field')}
              className="flex w-full items-center gap-1 px-3 py-2 text-sm font-medium hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              {fieldMeta.label}
            </button>
            <Separator />
            <div className="p-1">
              {fieldMeta.operators.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => handleOperatorSelect(op)}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <span
                    className={cn(
                      'h-3 w-3 rounded-full border',
                      selectedOperator === op ? 'border-primary bg-primary' : 'border-border',
                    )}
                  />
                  <span className="flex-1 text-left">{formatOperator(op)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Value selection */}
        {step === 'value' && fieldMeta && selectedOperator && (
          <div>
            <button
              type="button"
              onClick={() =>
                fieldMeta.operators.length > 1 ? setStep('operator') : setStep('field')
              }
              className="flex w-full items-center gap-1 px-3 py-2 text-sm font-medium hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              {fieldMeta.label}: {formatOperator(selectedOperator)}
            </button>
            <Separator />

            {/* Multi-select values */}
            {fieldMeta.valueType === 'multi-select' && (
              <MultiSelectValues
                field={selectedField!}
                selectedValues={selectedValues}
                onToggle={toggleValue}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statuses={statusesQuery.data ?? []}
                types={typesQuery.data ?? []}
                members={membersQuery.data?.data ?? []}
                labels={labelsQuery.data ?? []}
                cycles={cyclesQuery.data?.data ?? []}
              />
            )}

            {/* Date value */}
            {fieldMeta.valueType === 'date' && (
              <div className="p-3">
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* Text value */}
            {fieldMeta.valueType === 'text' && (
              <div className="p-3">
                <input
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApply();
                    }
                  }}
                  placeholder="검색어 입력..."
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            )}

            {/* Apply button */}
            <div className="p-3 pt-0">
              <Button
                size="sm"
                className="w-full"
                onClick={handleApply}
                disabled={
                  (fieldMeta.valueType === 'multi-select' && selectedValues.length === 0) ||
                  (fieldMeta.valueType === 'text' && !textValue.trim()) ||
                  (fieldMeta.valueType === 'date' && !dateValue)
                }
              >
                적용
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Multi-select value list ─────────────────────────────────────────────

function MultiSelectValues({
  field,
  selectedValues,
  onToggle,
  searchQuery,
  onSearchChange,
  statuses,
  types,
  members,
  labels,
  cycles,
}: {
  field: FilterField;
  selectedValues: string[];
  onToggle: (val: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statuses: IssueStatusOutput[];
  types: IssueTypeOutput[];
  members: MemberOutput[];
  labels: LabelOutput[];
  cycles: CycleOutput[];
}) {
  const items = useMemo(() => {
    switch (field) {
      case 'statusId':
        return statuses.map((s) => ({
          id: s.id,
          label: s.name,
          color: s.color,
        }));
      case 'typeId':
        return types.map((t) => ({
          id: t.id,
          label: t.name,
          color: t.color,
        }));
      case 'priority':
        return (Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => ({
          id: p,
          label: PRIORITY_CONFIG[p].label,
          color: PRIORITY_CONFIG[p].color,
        }));
      case 'assigneeId':
        return members.map((m) => ({
          id: m.user.id,
          label: m.user.name,
        }));
      case 'labelId':
        return labels.map((l) => ({
          id: l.id,
          label: l.name,
          color: l.color,
        }));
      case 'cycleId':
        return cycles.map((c) => ({
          id: c.id,
          label: c.name,
        }));
      default:
        return [];
    }
  }, [field, statuses, types, members, labels, cycles]);

  const showSearch = field === 'assigneeId' || field === 'labelId' || field === 'cycleId';

  const filtered = searchQuery
    ? items.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  return (
    <div>
      {showSearch && (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 rounded-md border border-border px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="검색..."
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}
      <div className="max-h-[240px] overflow-y-auto p-1">
        {filtered.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">검색 결과가 없습니다</div>
        )}
        {filtered.map((item) => {
          const isSelected = selectedValues.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent"
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border',
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </span>
              {item.color && !item.color.startsWith('text-') && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatOperator(op: FilterOperator): string {
  switch (op) {
    case 'is':
      return 'is';
    case 'is_not':
      return 'is not';
    case 'is_empty':
      return 'is empty';
    case 'is_not_empty':
      return 'is not empty';
    case 'includes':
      return 'includes';
    case 'excludes':
      return 'excludes';
    case 'contains':
      return 'contains';
    case 'before':
      return 'before';
    case 'after':
      return 'after';
    case 'between':
      return 'between';
    default:
      return op;
  }
}
