import { EmptyState } from '@/components/empty-state';
import { AppHeader } from '@/components/layout/app-header';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { ProjectCard } from '@/components/projects/project-card';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button, Skeleton } from '@worknest/ui';
import { Folder, Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/projects/')({
  component: ProjectListPage,
});

interface Project {
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

function ProjectListPage() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ['workspaces', wsId, 'projects'],
    queryFn: () => apiClient.getList<Project>(`/workspaces/${wsId}/projects`),
  });

  const projects = projectsQuery.data?.data ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AppHeader
        title="프로젝트"
        actions={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            프로젝트
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Loading */}
        {projectsQuery.isLoading && (
          <div
            className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="list"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                <Skeleton className="mb-3 h-9 w-9 rounded-lg" />
                <Skeleton className="mb-1 h-3 w-12" />
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {projectsQuery.isError && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-destructive">프로젝트를 불러올 수 없습니다.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => projectsQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {projectsQuery.isSuccess && projects.length === 0 && (
          <EmptyState
            icon={Folder}
            title="프로젝트가 없습니다"
            description="프로젝트를 만들어 이슈와 작업을 관리하세요"
            action={{
              label: '프로젝트 만들기',
              onClick: () => setCreateModalOpen(true),
            }}
          />
        )}

        {/* Project grid */}
        {projectsQuery.isSuccess && projects.length > 0 && (
          <div
            className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="list"
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                prefix={project.prefix}
                description={project.description}
                iconUrl={project.iconUrl}
                issueCounter={project.issueCounter}
                updatedAt={project.updatedAt}
                orgSlug={orgSlug}
                wsSlug={wsSlug}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        workspaceId={wsId}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
