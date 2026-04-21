import { FavoriteButton } from '@/components/favorite-button';
import { PageTree } from '@/components/wiki/page-tree/page-tree';
import { SpaceFormModal } from '@/components/wiki/space-form-modal';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import type { WikiPageOutput, WikiSpaceOutput } from '@worknest/shared';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@worknest/ui';
import { AlertTriangle, FileText, Loader2, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/wiki/$spaceId')({
  component: WikiSpaceLayout,
});

function WikiSpaceLayout() {
  const { orgSlug, wsSlug, spaceId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { pageId?: string };
  const hasSelectedPage = !!params.pageId;
  const [editOpen, setEditOpen] = useState(false);

  const spaceQuery = useQuery<WikiSpaceOutput>({
    queryKey: ['wiki-spaces', spaceId],
    queryFn: () => apiClient.get(`/wiki-spaces/${spaceId}`),
  });

  const pagesQuery = useQuery({
    queryKey: ['wiki-spaces', spaceId, 'pages'],
    queryFn: () => apiClient.getList<WikiPageOutput>(`/wiki-spaces/${spaceId}/pages`),
    enabled: !!spaceId,
  });

  const createPageMutation = useMutation({
    mutationFn: () =>
      apiClient.post<WikiPageOutput>(`/wiki-spaces/${spaceId}/pages`, {
        title: '새 페이지',
        slug: `page-${Date.now()}`,
      }),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
      navigate({
        to: '/$orgSlug/$wsSlug/wiki/$spaceId/$pageId',
        params: { orgSlug, wsSlug, spaceId, pageId: newPage.id },
      });
    },
    onError: () => {
      toast('페이지 생성에 실패했습니다.');
    },
  });

  if (spaceQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--fg-3)]" />
      </div>
    );
  }

  if (spaceQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[color:var(--priority-urgent)]" />
          <p className="mt-2 text-sm text-[color:var(--fg-3)]">스페이스를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const space = spaceQuery.data!;
  const pages = pagesQuery.data?.data ?? [];

  const handlePageSelect = (pageId: string) => {
    navigate({
      to: '/$orgSlug/$wsSlug/wiki/$spaceId/$pageId',
      params: { orgSlug, wsSlug, spaceId, pageId },
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Page tree panel */}
      <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-0)]">
        {/* Panel header */}
        <div className="group flex h-[48px] shrink-0 items-center gap-2 border-b border-[color:var(--border-subtle)] px-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[color:var(--fg-1)]">
            {space.name}
          </span>
          <span className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md bg-[color:var(--bg-3)] px-[6px] font-mono text-[11px] text-[color:var(--fg-2)]">
            {pages.length}
          </span>
          <FavoriteButton entityType="space" entityId={spaceId} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid h-6 w-6 place-items-center rounded-sm text-[color:var(--fg-3)] opacity-0 transition-opacity hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)] group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="스페이스 메뉴"
              >
                <MoreHorizontal className="h-[14px] w-[14px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                스페이스 수정
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Page tree */}
        <PageTree
          spaceId={spaceId}
          pages={pages}
          isLoading={pagesQuery.isLoading}
          onPageSelect={handlePageSelect}
          orgSlug={orgSlug}
          wsSlug={wsSlug}
        />
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-[color:var(--bg-0)]">
        {hasSelectedPage ? (
          <Outlet />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16">
            <FileText className="h-12 w-12 text-[color:var(--fg-4)]" />
            <p className="text-lg font-medium text-[color:var(--fg-1)]">
              페이지를 선택하거나 새 페이지를 만드세요
            </p>
            <p className="text-sm text-[color:var(--fg-3)]">
              왼쪽 트리에서 페이지를 선택하거나 아래 버튼으로 새 페이지를 만듭니다.
            </p>
            <Button
              className="mt-4"
              onClick={() => createPageMutation.mutate()}
              disabled={createPageMutation.isPending}
            >
              {createPageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>새 페이지 만들기</span>
            </Button>
          </div>
        )}
      </div>

      {/* Edit space modal */}
      <SpaceFormModal
        workspaceId={wsId}
        open={editOpen}
        onOpenChange={setEditOpen}
        space={space}
      />
    </div>
  );
}
