import { useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  Bookmark,
  Columns3,
  GanttChart,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
} from '@worknest/ui';
import type { ViewOutput, ViewType } from '@worknest/shared';
import { apiClient } from '../../lib/api-client';
import { useProjectContext } from '../../contexts/project-context';
import { viewToSearchParams } from '../../lib/view-utils';
import { SaveViewModal } from './save-view-modal';

// ── Props ──────────────────────────────────────────────────────────────

interface SavedViewsDropdownProps {
  currentViewType: ViewType;
}

// ── Component ──────────────────────────────────────────────────────────

export function SavedViewsDropdown({
  currentViewType,
}: SavedViewsDropdownProps) {
  const { projectId } = useProjectContext();
  const { orgSlug, wsSlug } = useParams({ strict: false }) as {
    orgSlug: string;
    wsSlug: string;
  };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ViewOutput | null>(null);

  // Fetch saved views
  const viewsQuery = useQuery<ViewOutput[]>({
    queryKey: ['projects', projectId, 'views'],
    queryFn: async () => {
      const result = await apiClient.getList<ViewOutput>(
        `/projects/${projectId}/views`,
      );
      return result.data;
    },
    staleTime: 30 * 1000,
  });

  // Delete view mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: (viewId: string) =>
      apiClient.delete(`/views/${viewId}`),
    onMutate: async (viewId: string) => {
      await queryClient.cancelQueries({
        queryKey: ['projects', projectId, 'views'],
      });
      const previousViews = queryClient.getQueryData<ViewOutput[]>([
        'projects',
        projectId,
        'views',
      ]);
      queryClient.setQueryData<ViewOutput[]>(
        ['projects', projectId, 'views'],
        (old) => old?.filter((v) => v.id !== viewId) ?? [],
      );
      return { previousViews };
    },
    onError: (_err, _viewId, context) => {
      if (context?.previousViews) {
        queryClient.setQueryData(
          ['projects', projectId, 'views'],
          context.previousViews,
        );
      }
      toast('뷰 삭제에 실패했습니다.');
    },
    onSuccess: () => {
      toast('뷰가 삭제되었습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'views'],
      });
    },
  });

  // Apply a saved view: navigate to the correct view type with filter params
  function handleApplyView(view: ViewOutput) {
    const searchParams = viewToSearchParams(view);
    const targetPaths: Record<string, string> = {
      board: '/$orgSlug/$wsSlug/projects/$projectId/board',
      gantt: '/$orgSlug/$wsSlug/projects/$projectId/gantt',
      list: '/$orgSlug/$wsSlug/projects/$projectId/issues',
    };
    const targetPath = targetPaths[view.type] ?? targetPaths.list;

    navigate({
      to: targetPath,
      params: { orgSlug, wsSlug, projectId },
      search: searchParams as Record<string, unknown>,
    });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  const views = viewsQuery.data ?? [];

  const viewTypeIcon = (type: ViewType) => {
    if (type === 'board')
      return <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />;
    if (type === 'gantt')
      return <GanttChart className="h-3.5 w-3.5 text-muted-foreground" />;
    return <List className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-haspopup="menu"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>뷰</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-[240px]" align="start">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            저장된 뷰
          </DropdownMenuLabel>

          {/* Loading state */}
          {viewsQuery.isLoading && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              불러오는 중...
            </div>
          )}

          {/* Empty state */}
          {!viewsQuery.isLoading && views.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              저장된 뷰가 없습니다
            </div>
          )}

          {/* View list */}
          {views.map((view) => (
            <DropdownMenuSub key={view.id}>
              <div className="group flex items-center">
                <DropdownMenuItem
                  className="flex-1 cursor-pointer"
                  onSelect={() => handleApplyView(view)}
                >
                  {viewTypeIcon(view.type)}
                  <span className="truncate">{view.name}</span>
                </DropdownMenuItem>
                <DropdownMenuSubTrigger className="ml-auto h-7 w-7 flex-shrink-0 justify-center p-0 opacity-0 group-hover:opacity-100 focus:opacity-100">
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuSubTrigger>
              </div>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onSelect={() => setDeleteTarget(view)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}

          <DropdownMenuSeparator />

          {/* Save current view action */}
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setSaveModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            현재 뷰 저장
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save view modal */}
      <SaveViewModal
        open={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        viewType={currentViewType}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>뷰 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; 뷰를 삭제하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
