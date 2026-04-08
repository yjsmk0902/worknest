import { useQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { ErrorPage } from '@/components/error-page';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { ApiError, apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

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
  const navigate = useNavigate();
  const { setCurrentOrg, setCurrentWorkspace } = useAuthStore();

  const orgQuery = useQuery<OrgBySlugResponse>({
    queryKey: ['org-by-slug', orgSlug],
    queryFn: () => apiClient.get(`/organizations/by-slug/${orgSlug}`),
    staleTime: 5 * 60 * 1000,
  });

  const wsQuery = useQuery<WsBySlugResponse>({
    queryKey: ['ws-by-slug', orgSlug, wsSlug],
    queryFn: () => apiClient.get(`/workspaces/by-slug/${orgSlug}/${wsSlug}`),
    staleTime: 5 * 60 * 1000,
  });

  const org = orgQuery.data;
  const ws = wsQuery.data;

  useEffect(() => {
    if (!org || !ws) return;
    setCurrentOrg({ id: org.id, name: org.name, slug: org.slug, logo: null });
    setCurrentWorkspace({
      id: ws.id,
      orgId: ws.orgId,
      name: ws.name,
      slug: ws.slug,
      logo: null,
      description: null,
    });
  }, [org, ws, setCurrentOrg, setCurrentWorkspace]);

  if (orgQuery.isLoading || wsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orgQuery.isError || wsQuery.isError) {
    const error = orgQuery.error ?? wsQuery.error;
    const is403 = error instanceof ApiError && error.status === 403;

    if (is403) {
      return (
        <ErrorPage
          code="403"
          icon={ShieldAlert}
          title="접근 권한이 없습니다"
          description="이 워크스페이스에 접근할 수 있는 권한이 없습니다. 관리자에게 초대를 요청해주세요."
          primaryAction={{
            label: '홈으로 이동',
            onClick: () => navigate({ to: '/' }),
          }}
        />
      );
    }

    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">워크스페이스를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const contextValue: WorkspaceContextValue = {
    orgId: org?.id,
    orgSlug: org?.slug,
    orgName: org?.name,
    wsId: ws?.id,
    wsSlug: ws?.slug,
    wsName: ws?.name,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <Outlet />
    </WorkspaceContext.Provider>
  );
}
