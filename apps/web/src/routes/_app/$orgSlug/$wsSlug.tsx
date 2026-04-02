import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from '../../../contexts/workspace-context';

interface OrgBySlugResponse {
  id: string;
  name: string;
  slug: string;
}

interface WsBySlugResponse {
  id: string;
  orgId: string;
  orgSlug: string;
  name: string;
  slug: string;
}

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug')({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { orgSlug, wsSlug } = Route.useParams();

  const orgQuery = useQuery<OrgBySlugResponse>({
    queryKey: ['org-by-slug', orgSlug],
    queryFn: () => apiClient.get(`/organizations/by-slug/${orgSlug}`),
    staleTime: 5 * 60 * 1000,
  });

  const wsQuery = useQuery<WsBySlugResponse>({
    queryKey: ['ws-by-slug', orgSlug, wsSlug],
    queryFn: () =>
      apiClient.get(`/workspaces/by-slug/${orgSlug}/${wsSlug}`),
    staleTime: 5 * 60 * 1000,
  });

  if (orgQuery.isLoading || wsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orgQuery.isError || wsQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            워크스페이스를 불러올 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const org = orgQuery.data!;
  const ws = wsQuery.data!;

  const contextValue: WorkspaceContextValue = {
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    wsId: ws.id,
    wsSlug: ws.slug,
    wsName: ws.name,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <Outlet />
    </WorkspaceContext.Provider>
  );
}
