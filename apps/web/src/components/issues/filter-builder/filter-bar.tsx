import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@worknest/ui';
import { apiClient, type ListResponse } from '../../../lib/api-client';
import { useProjectContext } from '../../../contexts/project-context';
import { useIssueFilters, type ActiveFilter } from './use-issue-filters';
import { FilterChip } from './filter-chip';
import { FilterPopover } from './filter-popover';
import type { FilterField, IssueStatusOutput, IssueTypeOutput } from '@worknest/shared';

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

// ── Component ───────────────────────────────────────────────────────────

export function FilterBar() {
  const { projectId } = useProjectContext();
  const { filters, addFilter, removeFilter, hasFilters, clearAllFilters } =
    useIssueFilters();

  const [editingField, setEditingField] = useState<FilterField | null>(null);
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);

  // Fetch reference data for chip display
  const statusesQuery = useQuery<IssueStatusOutput[]>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () =>
      apiClient.get<IssueStatusOutput[]>(
        `/projects/${projectId}/statuses`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  const typesQuery = useQuery<IssueTypeOutput[]>({
    queryKey: ['projects', projectId, 'types'],
    queryFn: () =>
      apiClient.get<IssueTypeOutput[]>(
        `/projects/${projectId}/types`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  const membersQuery = useQuery<ListResponse<MemberOutput>>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () =>
      apiClient.getList<MemberOutput>(`/projects/${projectId}/members`),
    staleTime: 5 * 60 * 1000,
  });

  const labelsQuery = useQuery<LabelOutput[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () =>
      apiClient.get<LabelOutput[]>(`/projects/${projectId}/labels`),
    staleTime: 5 * 60 * 1000,
  });

  const statuses = statusesQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const members = membersQuery.data?.data ?? [];
  const labels = labelsQuery.data ?? [];

  const editingFilter = editingField
    ? filters.find((f) => f.field === editingField)
    : undefined;

  function handleApplyFilter(filter: ActiveFilter) {
    addFilter(filter);
    setEditingField(null);
    setEditPopoverOpen(false);
  }

  function handleEditChip(field: FilterField) {
    setEditingField(field);
    setEditPopoverOpen(true);
  }

  if (!hasFilters) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2"
      role="region"
      aria-label="활성 필터"
    >
      {filters.map((filter) => (
        <div key={filter.field}>
          {editingField === filter.field ? (
            <FilterPopover
              editingFilter={editingFilter}
              filterCount={0}
              onApply={handleApplyFilter}
              open={editPopoverOpen}
              onOpenChange={(open) => {
                setEditPopoverOpen(open);
                if (!open) setEditingField(null);
              }}
              trigger={
                <FilterChip
                  filter={filter}
                  statuses={statuses}
                  types={types}
                  members={members}
                  labels={labels}
                  onEdit={() => {}}
                  onRemove={() => removeFilter(filter.field)}
                />
              }
            />
          ) : (
            <FilterChip
              filter={filter}
              statuses={statuses}
              types={types}
              members={members}
              labels={labels}
              onEdit={() => handleEditChip(filter.field)}
              onRemove={() => removeFilter(filter.field)}
            />
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={clearAllFilters}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        필터 초기화
      </Button>
    </div>
  );
}
