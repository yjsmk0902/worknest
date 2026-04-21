import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { WikiSpaceOutput } from '@worknest/shared';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/projects/$projectId/wiki/')({
  component: ProjectWikiRedirect,
});

/**
 * Project wiki shortcut: fetches the project's default wiki space and
 * redirects the user to the main wiki space layout so they can browse it
 * with the normal page tree.
 */
function ProjectWikiRedirect() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const navigate = useNavigate();

  const spaceQuery = useQuery<WikiSpaceOutput>({
    queryKey: ['projects', projectId, 'wiki-space'],
    queryFn: () => apiClient.get(`/projects/${projectId}/wiki-space`),
  });

  useEffect(() => {
    if (spaceQuery.data) {
      navigate({
        to: '/$orgSlug/$wsSlug/wiki/$spaceId',
        params: { orgSlug, wsSlug, spaceId: spaceQuery.data.id },
        replace: true,
      });
    }
  }, [spaceQuery.data, navigate, orgSlug, wsSlug]);

  if (spaceQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[color:var(--priority-urgent)]" />
          <p className="mt-2 text-sm text-[color:var(--fg-3)]">
            프로젝트 위키를 불러올 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[color:var(--fg-3)]" />
    </div>
  );
}
