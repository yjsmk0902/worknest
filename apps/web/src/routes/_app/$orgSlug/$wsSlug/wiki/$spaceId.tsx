import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { WikiSpaceOutput, WikiPageOutput } from '@worknest/shared/schemas/wiki';
import { apiClient } from '../../../../../lib/api-client';
import { PageTree } from '../../../../../components/wiki/page-tree/page-tree';
import { useWorkspaceContext } from '../../../../../contexts/workspace-context';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/wiki/$spaceId',
)({
  component: WikiSpaceLayout,
});

function WikiSpaceLayout() {
  const { orgSlug, wsSlug, spaceId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const navigate = useNavigate();

  const spaceQuery = useQuery<WikiSpaceOutput>({
    queryKey: ['wiki-spaces', spaceId],
    queryFn: () =>
      apiClient.get(`/wiki-spaces/${spaceId}`),
  });

  const pagesQuery = useQuery({
    queryKey: ['wiki-spaces', spaceId, 'pages'],
    queryFn: () =>
      apiClient.getList<WikiPageOutput>(`/wiki-spaces/${spaceId}/pages`),
    enabled: !!spaceId,
  });

  if (spaceQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (spaceQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            스페이스를 불러올 수 없습니다.
          </p>
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
      <div className="w-[240px] shrink-0 border-r border-border bg-muted/30 flex flex-col h-full">
        {/* Panel header */}
        <div className="h-12 flex items-center justify-between px-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate">
              {space.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {pages.length} pages
            </span>
          </div>
        </div>

        {/* Page tree */}
        <div className="flex-1 overflow-y-auto">
          <PageTree
            spaceId={spaceId}
            pages={pages}
            isLoading={pagesQuery.isLoading}
            onPageSelect={handlePageSelect}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
          />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
