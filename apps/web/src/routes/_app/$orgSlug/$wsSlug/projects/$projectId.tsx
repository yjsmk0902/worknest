import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@worknest/ui';
import { apiClient } from '@/lib/api-client';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import {
  ProjectContext,
  type ProjectContextValue,
} from '@/contexts/project-context';
import { useIssueRealtime } from '@/hooks/use-issue-realtime';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId',
)({
  component: ProjectLayout,
});

interface ProjectResponse {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  prefix: string;
  iconUrl: string | null;
  issueCounter: number;
  createdAt: string;
  updatedAt: string;
}

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();

  useIssueRealtime(projectId);

  const projectQuery = useQuery<ProjectResponse>({
    queryKey: ['projects', projectId],
    queryFn: () =>
      apiClient.get(`/workspaces/${wsId}/projects/${projectId}`),
    staleTime: 5 * 60 * 1000,
  });

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            프로젝트를 불러올 수 없습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => projectQuery.refetch()}
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const project = projectQuery.data!;

  const contextValue: ProjectContextValue = {
    projectId: project.id,
    projectName: project.name,
    prefix: project.prefix,
    wsId,
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      <Outlet />
    </ProjectContext.Provider>
  );
}
