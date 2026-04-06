import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Separator,
  toast,
} from '@worknest/ui';
import { apiClient } from '../../lib/api-client';
import type { CycleOutput, CreateCycleInput, UpdateCycleInput } from '@worknest/shared';

// ── Types ───────────────────────────────────────────────────────────────

interface CycleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** If provided, the modal is in edit mode */
  cycle?: CycleOutput;
}

// ── Component ───────────────────────────────────────────────────────────

export function CycleFormModal({
  open,
  onOpenChange,
  projectId,
  cycle,
}: CycleFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!cycle;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [nameError, setNameError] = useState('');
  const [dateError, setDateError] = useState('');

  // Fetch existing cycles for overlap check
  const cyclesQuery = useQuery<CycleOutput[]>({
    queryKey: ['projects', projectId, 'cycles'],
    queryFn: async () => {
      const res = await apiClient.getList<CycleOutput>(
        `/projects/${projectId}/cycles`,
      );
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: open,
  });

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (cycle) {
        setName(cycle.name);
        setDescription(cycle.description ?? '');
        setStartDate(cycle.startDate ?? '');
        setEndDate(cycle.endDate ?? '');
      } else {
        setName('');
        setDescription('');
        setStartDate('');
        setEndDate('');
      }
      setNameError('');
      setDateError('');
    }
  }, [open, cycle]);

  // Overlap detection
  const overlappingCycle = (() => {
    if (!startDate || !endDate || !cyclesQuery.data) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return cyclesQuery.data.find((c) => {
      if (cycle && c.id === cycle.id) return false;
      if (!c.startDate || !c.endDate) return false;
      const cStart = new Date(c.startDate);
      const cEnd = new Date(c.endDate);
      return start <= cEnd && end >= cStart;
    });
  })();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateCycleInput) =>
      apiClient.post<CycleOutput>(`/projects/${projectId}/cycles`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'cycles'],
      });
      toast('사이클이 생성되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast('사이클 생성에 실패했습니다.');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateCycleInput) =>
      apiClient.patch<CycleOutput>(
        `/cycles/${cycle!.id}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'cycles'],
      });
      queryClient.invalidateQueries({
        queryKey: ['cycles', cycle!.id],
      });
      toast('사이클이 수정되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast('사이클 수정에 실패했습니다.');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    let valid = true;

    if (!name.trim()) {
      setNameError('사이클 이름은 필수입니다');
      valid = false;
    } else if (name.trim().length > 100) {
      setNameError('사이클 이름은 100자 이내여야 합니다');
      valid = false;
    } else {
      setNameError('');
    }

    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      setDateError('종료일은 시작일 이후여야 합니다');
      valid = false;
    } else {
      setDateError('');
    }

    return valid;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({
        name: data.name,
        description: data.description ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? '사이클 편집' : '사이클 생성'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? '사이클 정보를 수정합니다.'
              : '새로운 사이클을 생성합니다.'}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="cycle-name">사이클 이름 *</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="사이클 이름을 입력하세요"
              autoFocus
              maxLength={100}
            />
            {nameError && (
              <p className="mt-1 text-sm text-destructive">{nameError}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="cycle-description">설명</Label>
            <textarea
              id="cycle-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="사이클 목표나 설명을 입력하세요 (선택)"
              rows={3}
              maxLength={500}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cycle-start-date">시작일</Label>
              <Input
                id="cycle-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (dateError) setDateError('');
                }}
              />
            </div>
            <div>
              <Label htmlFor="cycle-end-date">종료일</Label>
              <Input
                id="cycle-end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (dateError) setDateError('');
                }}
              />
            </div>
          </div>

          {dateError && (
            <p className="text-sm text-destructive">{dateError}</p>
          )}

          {/* Overlap warning */}
          {overlappingCycle && (
            <div className="flex items-center gap-2 text-sm text-orange-500 mt-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                이 기간은 &ldquo;{overlappingCycle.name}&rdquo; 사이클과
                겹칩니다
              </span>
            </div>
          )}

          <Separator />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? '저장 중...'
                : isEdit
                  ? '저장'
                  : '사이클 생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
