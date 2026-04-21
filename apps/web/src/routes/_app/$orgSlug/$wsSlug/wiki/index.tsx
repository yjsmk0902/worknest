import { EmptyState } from '@/components/empty-state';
import { AppHeader } from '@/components/layout/app-header';
import { SpaceFormModal } from '@/components/wiki/space-form-modal';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type { WikiSpaceOutput } from '@worknest/shared';
import { Button, Skeleton } from '@worknest/ui';
import { AlertTriangle, BookOpen, Clock, FileText, LibraryBig, Plus } from 'lucide-react';
import { useState } from 'react';

interface RecentWikiPage {
  id: string;
  wikiSpaceId: string;
  spaceName: string;
  title: string;
  slug: string;
  icon: string | null;
  updatedAt: string;
}

function formatRelative(dateString: string) {
  const now = Date.now();
  const d = new Date(dateString).getTime();
  const diffMin = Math.floor((now - d) / 60_000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/wiki/')({
  component: WikiIndexPage,
});

function WikiIndexPage() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const spacesQuery = useQuery({
    queryKey: ['workspaces', wsId, 'wiki-spaces'],
    queryFn: () => apiClient.getList<WikiSpaceOutput>(`/workspaces/${wsId}/wiki-spaces`),
  });

  const recentQuery = useQuery({
    queryKey: ['workspaces', wsId, 'wiki-pages', 'recent'],
    queryFn: () =>
      apiClient.get<RecentWikiPage[]>(`/workspaces/${wsId}/wiki-pages/recent?limit=8`),
    staleTime: 30 * 1000,
  });

  const spaces = spacesQuery.data?.data ?? [];
  const totalSpaces = spaces.length;
  const recent = recentQuery.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="위키"
        actions={
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>스페이스 생성</span>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1200px] px-6 py-10">
          {/* Page intro */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-semibold text-[color:var(--fg-1)]">위키</h1>
              {totalSpaces > 0 && (
                <span className="inline-flex h-[22px] items-center rounded-md bg-[color:var(--bg-3)] px-[8px] font-mono text-[11.5px] font-medium text-[color:var(--fg-2)]">
                  {totalSpaces}
                </span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-[color:var(--fg-3)]">
              팀의 지식과 문서를 스페이스로 정리합니다.
            </p>
          </div>

          {/* Recent pages */}
          {recent.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[color:var(--fg-3)]" />
                <h2 className="text-[13px] font-medium text-[color:var(--fg-2)]">
                  최근 편집
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {recent.map((p) => (
                  <Link
                    key={p.id}
                    to="/$orgSlug/$wsSlug/wiki/$spaceId/$pageId"
                    params={{ orgSlug, wsSlug, spaceId: p.wikiSpaceId, pageId: p.id }}
                    className="group flex flex-col rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] p-3 transition-colors hover:border-[color:var(--border)]"
                  >
                    <div className="flex items-center gap-1.5">
                      {p.icon ? (
                        <span className="text-[14px] leading-none">{p.icon}</span>
                      ) : (
                        <FileText className="h-[13px] w-[13px] text-[color:var(--fg-3)]" />
                      )}
                      <span className="truncate text-[13px] font-medium text-[color:var(--fg-1)]">
                        {p.title || '제목 없음'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[color:var(--fg-4)]">
                      <span className="truncate">{p.spaceName}</span>
                      <span>·</span>
                      <span className="shrink-0">{formatRelative(p.updatedAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Loading */}
          {spacesQuery.isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] p-5"
                >
                  <Skeleton className="mb-4 h-10 w-10 rounded-lg" />
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
                <AlertTriangle className="mx-auto h-8 w-8 text-[color:var(--priority-urgent)]" />
                <p className="mt-2 text-sm text-[color:var(--fg-3)]">
                  위키 스페이스를 불러올 수 없습니다.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
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
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              role="list"
            >
              {spaces.map((space) => (
                <Link
                  key={space.id}
                  to="/$orgSlug/$wsSlug/wiki/$spaceId"
                  params={{ orgSlug, wsSlug, spaceId: space.id }}
                  className="group flex flex-col rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] p-5 transition-colors duration-150 hover:border-[color:var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-bg)]"
                  role="listitem"
                  aria-label={`스페이스: ${space.name}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--bg-3)]">
                    <LibraryBig className="h-5 w-5 text-[color:var(--fg-2)]" />
                  </div>

                  <span className="mt-1 font-mono text-[11.5px] text-[color:var(--fg-4)]">
                    {space.slug}
                  </span>

                  <h3 className="mt-0.5 truncate text-[15px] font-semibold text-[color:var(--fg-1)]">
                    {space.name}
                  </h3>

                  {space.description && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] text-[color:var(--fg-3)]">
                      {space.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <SpaceFormModal workspaceId={wsId} open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  );
}
