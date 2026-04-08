import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { IssueDetailPanel } from '@/components/issues/issue-detail/issue-detail-panel';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId',
)({
  component: IssueDetailPage,
});

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

function IssueDetailPage() {
  const { orgSlug, wsSlug, projectId, issueId } = Route.useParams();
  const { wsId } = useWorkspaceContext();

  // Fetch project info for prefix
  const projectQuery = useQuery<ProjectOutput>({
    queryKey: ['projects', projectId],
    queryFn: () =>
      apiClient.get<ProjectOutput>(
        `/workspaces/${wsId}/projects/${projectId}`,
      ),
    staleTime: 5 * 60 * 1000,
  });

  const projectPrefix = projectQuery.data?.prefix ?? '...';

  return (
    <IssueDetailPanel
      issueId={issueId}
      projectId={projectId}
      projectPrefix={projectPrefix}
      orgSlug={orgSlug}
      wsSlug={wsSlug}
      mode="full-page"
    />
  );
}
