import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MoreHorizontal,
  Loader2,
  Tag,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label as FormLabel } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@worknest/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { apiClient } from '@/lib/api-client';
import { ProjectSettingsLayout } from '@/components/projects/settings-layout';
import { useProjectContext } from '@/contexts/project-context';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/settings/labels',
)({
  component: ProjectSettingsLabels,
});

interface LabelData {
  id: string;
  projectId: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
}

const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
];

function ProjectSettingsLabels() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { projectName } = useProjectContext();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editLabel, setEditLabel] = useState<LabelData | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<LabelData | null>(null);

  const labelsQuery = useQuery<LabelData[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () =>
      apiClient.get<LabelData[]>(`/projects/${projectId}/labels`),
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      apiClient.delete(`/projects/${projectId}/labels/${labelId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'labels'],
      });
      toast('라벨이 삭제되었습니다.');
      setDeleteLabel(null);
    },
    onError: () => {
      toast('라벨 삭제에 실패했습니다.');
    },
  });

  const labels = labelsQuery.data ?? [];

  return (
    <ProjectSettingsLayout
      orgSlug={orgSlug}
      wsSlug={wsSlug}
      projectId={projectId}
      projectName={projectName}
      activeTab="labels"
    >
      <div className="max-w-[720px] space-y-8 p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">라벨</h2>
            <p className="text-sm text-muted-foreground">
              프로젝트의 이슈 라벨을 관리합니다.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            라벨 추가
          </Button>
        </div>

        {/* Loading */}
        {labelsQuery.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
              >
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {labelsQuery.isError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive">
              라벨 목록을 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => labelsQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty state */}
        {labelsQuery.isSuccess && labels.length === 0 && (
          <div className="rounded-md border border-border bg-muted/50 p-8 text-center">
            <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-base font-medium text-foreground">
              라벨이 없습니다
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              이슈를 분류할 라벨을 만들어보세요
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              라벨 추가
            </Button>
          </div>
        )}

        {/* Label list */}
        {labelsQuery.isSuccess && labels.length > 0 && (
          <div className="rounded-md border border-border">
            {labels.map((label) => (
              <div
                key={label.id}
                className="flex items-center border-b border-border px-4 last:border-b-0 hover:bg-accent/50"
                style={{ minHeight: '44px' }}
              >
                <div className="flex flex-1 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="text-sm font-medium">{label.name}</span>
                  {label.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {label.description}
                    </span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="작업 메뉴"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditLabel(label)}>
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteLabel(label)}
                    >
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Label Modal */}
      <LabelFormModal
        projectId={projectId}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: ['projects', projectId, 'labels'],
          })
        }
      />

      {/* Edit Label Modal */}
      <LabelFormModal
        projectId={projectId}
        label={editLabel ?? undefined}
        open={editLabel !== null}
        onOpenChange={(open) => {
          if (!open) setEditLabel(null);
        }}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: ['projects', projectId, 'labels'],
          })
        }
      />

      {/* Delete Label Confirmation */}
      <Dialog
        open={deleteLabel !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteLabel(null);
        }}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>라벨 삭제</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              &quot;{deleteLabel?.name}&quot; 라벨을 삭제하시겠습니까?
            </p>
            <p className="text-sm text-muted-foreground">
              이 라벨이 적용된 이슈에서 자동으로 제거됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteLabel(null)}
              disabled={deleteLabelMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLabelMutation.isPending}
              onClick={() => {
                if (deleteLabel) {
                  deleteLabelMutation.mutate(deleteLabel.id);
                }
              }}
            >
              {deleteLabelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectSettingsLayout>
  );
}

function LabelFormModal({
  projectId,
  label,
  open,
  onOpenChange,
  onSuccess,
}: {
  projectId: string;
  label?: LabelData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = !!label;
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState(label?.color ?? LABEL_COLORS[0]);
  const [description, setDescription] = useState(label?.description ?? '');

  // Reset form when modal opens with different label or closes
  const [prevLabel, setPrevLabel] = useState<LabelData | undefined>(label);
  if (label !== prevLabel) {
    setPrevLabel(label);
    setName(label?.name ?? '');
    setColor(label?.color ?? LABEL_COLORS[0]);
    setDescription(label?.description ?? '');
  }

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      color: string;
      description?: string | null;
    }) => apiClient.post(`/projects/${projectId}/labels`, data),
    onSuccess: () => {
      toast('라벨이 생성되었습니다.');
      onSuccess();
      setName('');
      setColor(LABEL_COLORS[0]);
      setDescription('');
      onOpenChange(false);
    },
    onError: () => {
      toast('라벨 생성에 실패했습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      color?: string;
      description?: string | null;
    }) =>
      apiClient.patch(
        `/projects/${projectId}/labels/${label?.id}`,
        data,
      ),
    onSuccess: () => {
      toast('라벨이 수정되었습니다.');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast('라벨 수정에 실패했습니다.');
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      color,
      description: description.trim() || null,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const error = createMutation.error || updateMutation.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '라벨 수정' : '라벨 추가'}</DialogTitle>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <FormLabel htmlFor="label-name">이름</FormLabel>
            <Input
              id="label-name"
              placeholder="라벨 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              maxLength={50}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <FormLabel>색상</FormLabel>
            <div className="grid grid-cols-8 gap-1">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform duration-150 hover:scale-110',
                    color === c && 'ring-2 ring-ring ring-offset-2',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`색상 ${c}`}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <FormLabel htmlFor="label-desc">설명</FormLabel>
            <Input
              id="label-desc"
              placeholder="라벨 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              maxLength={200}
            />
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
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
            >
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
