import { apiClient } from '@/lib/api-client';
import { viewToSearchParams } from '@/lib/view-utils';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ViewOutput } from '@worknest/shared';
import { Button } from '@worknest/ui';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/projects/$projectId/views/$viewId')({
  component: ViewRedirectPage,
});

function ViewRedirectPage() {
  const { orgSlug, wsSlug, projectId, viewId } = Route.useParams();
  const navigate = useNavigate();

  const viewQuery = useQuery<ViewOutput>({
    queryKey: ['views', viewId],
    queryFn: () => apiClient.get<ViewOutput>(`/views/${viewId}`),
    staleTime: 30 * 1000,
  });

  // Redirect once view data is loaded
  useEffect(() => {
    if (!viewQuery.data) return;

    const view = viewQuery.data;
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
      replace: true,
    });
  }, [viewQuery.data, navigate, orgSlug, wsSlug, projectId]);

  // Loading state
  if (viewQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (viewQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">뷰를 불러올 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => viewQuery.refetch()}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  // Brief loading indicator while redirecting
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
