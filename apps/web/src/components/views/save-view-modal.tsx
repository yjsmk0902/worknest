import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateViewInput, SortField, ViewOutput, ViewSort, ViewType } from '@worknest/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from '@worknest/ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProjectContext } from '../../contexts/project-context';
import { apiClient } from '../../lib/api-client';
import {
  activeFiltersToConditions,
  getSortDisplayText,
  getViewTypeLabel,
} from '../../lib/view-utils';
import { getFieldMeta, useIssueFilters } from '../issues/filter-builder/use-issue-filters';

// ── Props ──────────────────────────────────────────────────────────────

interface SaveViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewType: ViewType;
}

// ── Component ──────────────────────────────────────────────────────────

export function SaveViewModal({ open, onOpenChange, viewType }: SaveViewModalProps) {
  const { projectId } = useProjectContext();
  const queryClient = useQueryClient();
  const { filters, apiParams } = useIssueFilters();

  const [name, setName] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
    }
  }, [open]);

  // Build sort object from current URL params
  const currentSort: ViewSort | undefined = apiParams.sort
    ? {
        field: apiParams.sort as SortField,
        direction: (apiParams.order ?? 'desc') as 'asc' | 'desc',
      }
    : undefined;

  // Build filter conditions from active filters
  const filterConditions = activeFiltersToConditions(filters);

  // Sort display text
  const sortText = getSortDisplayText(currentSort ?? null);

  // Create view mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateViewInput) =>
      apiClient.post<ViewOutput>(`/projects/${projectId}/views`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'views'],
      });
      toast('뷰가 저장되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast('뷰 저장에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    createMutation.mutate({
      name: trimmedName,
      type: viewType,
      filters: filterConditions,
      sort: currentSort,
    });
  }

  const canSubmit = name.trim().length > 0 && !createMutation.isPending;
  const isLoading = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>뷰 저장</DialogTitle>
          <DialogDescription className="sr-only">
            현재 필터와 정렬 설정을 뷰로 저장합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="view-name">이름</Label>
            <Input
              id="view-name"
              placeholder="뷰 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Applied filters summary */}
          <div className="space-y-2">
            <span className="text-sm font-medium">적용된 필터</span>
            {filterConditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {filterConditions.map((condition) => {
                  const meta = getFieldMeta(condition.field);
                  const label = meta?.label ?? condition.field;
                  const values = Array.isArray(condition.value)
                    ? condition.value.join(', ')
                    : (condition.value ?? '');
                  return (
                    <span
                      key={`${condition.field}-${condition.operator}`}
                      className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium opacity-75"
                    >
                      {label}: {values || '없음'}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">적용된 필터가 없습니다</p>
            )}
          </div>

          {/* Sort summary */}
          <div className="space-y-2">
            <span className="text-sm font-medium">정렬</span>
            <p className="text-sm text-muted-foreground">{sortText}</p>
          </div>

          {/* View type */}
          <div className="space-y-2">
            <span className="text-sm font-medium">뷰 타입</span>
            <p className="text-sm text-muted-foreground">{getViewTypeLabel(viewType)}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
