import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, BookOpen } from 'lucide-react';
import { Button, Skeleton } from '@worknest/ui';
import type { WikiSpaceOutput } from '@worknest/shared';
import { apiClient } from '@/lib/api-client';
import { AppHeader } from '@/components/layout/app-header';
import { SpaceFormModal } from '@/components/wiki/space-form-modal';
import { EmptyState } from '@/components/empty-state';
import { useWorkspaceContext } from '@/contexts/workspace-context';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/wiki/',
)({
  component: WikiIndexPage,
});

function WikiIndexPage() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const spacesQuery = useQuery({
    queryKey: ['workspaces', wsId, 'wiki-spaces'],
    queryFn: () =>
      apiClient.getList<WikiSpaceOutput>(
        `/workspaces/${wsId}/wiki-spaces`,
      ),
  });

  const spaces = spacesQuery.data?.data ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AppHeader
        title="Wiki"
        actions={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            스페이스
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Loading */}
        {spacesQuery.isLoading && (
          <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4"
              >
                <Skeleton className="mb-3 h-9 w-9 rounded-lg" />
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {spacesQuery.isError && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-destructive">
                위키 스페이스를 불러올 수 없습니다.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => spacesQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {spacesQuery.isSuccess && spaces.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="지식을 한 곳에 모아보세요"
            description="스페이스를 만들어 팀의 문서를 정리하세요"
            action={{
              label: '스페이스 만들기',
              onClick: () => setCreateModalOpen(true),
            }}
          />
        )}

        {/* Space grid */}
        {spacesQuery.isSuccess && spaces.length > 0 && (
          <div
            className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            role="list"
          >
            {spaces.map((space) => (
              <Link
                key={space.id}
                to="/$orgSlug/$wsSlug/wiki/$spaceId"
                params={{ orgSlug, wsSlug, spaceId: space.id }}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:shadow-sm"
                role="listitem"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary">
                  {space.name}
                </h3>
                {space.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {space.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <SpaceFormModal
        workspaceId={wsId}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
