import { BulkActionBar } from '@/components/issues/bulk-action-bar';
import { CsvModal } from '@/components/issues/csv-modal';
import { FilterBar } from '@/components/issues/filter-builder/filter-bar';
import { useIssueFilters } from '@/components/issues/filter-builder/use-issue-filters';
import { IssueDetailPanel } from '@/components/issues/issue-detail/issue-detail-panel';
import { GroupedIssuesList } from '@/components/issues/list-view/grouped-issues-list';
import { IssueListTable } from '@/components/issues/list-view/issue-list-table';
import { QuickAdd } from '@/components/issues/quick-add';
import { ViewToolbar } from '@/components/issues/view-toolbar';
import { AppHeader } from '@/components/layout/app-header';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { useHotkey } from '@/hooks/use-hotkey';
import { useIssueListShortcuts } from '@/hooks/use-issue-list-shortcuts';
import { type ListResponse, apiClient } from '@/lib/api-client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { RowSelectionState } from '@tanstack/react-table';
import type { IssueOutput } from '@worknest/shared';
import { Button, Skeleton } from '@worknest/ui';
import { AlertTriangle, FileSpreadsheet, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

// ── Search param validation ─────────────────────────────────────────────

const issueSearchSchema = z.object({
  statusId: z.string().optional().catch(undefined),
  statusIdNot: z.string().optional().catch(undefined),
  typeId: z.string().optional().catch(undefined),
  typeIdNot: z.string().optional().catch(undefined),
  priority: z.string().optional().catch(undefined),
  priorityNot: z.string().optional().catch(undefined),
  assigneeId: z.string().optional().catch(undefined),
  assigneeIdNot: z.string().optional().catch(undefined),
  assigneeEmpty: z.coerce.boolean().optional().catch(undefined),
  labelId: z.string().optional().catch(undefined),
  labelIdNot: z.string().optional().catch(undefined),
  dueBefore: z.string().optional().catch(undefined),
  dueAfter: z.string().optional().catch(undefined),
  dueEmpty: z.coerce.boolean().optional().catch(undefined),
  cycleId: z.string().optional().catch(undefined),
  cycleIdNot: z.string().optional().catch(undefined),
  cycleEmpty: z.coerce.boolean().optional().catch(undefined),
  title: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  order: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/projects/$projectId/issues/')({
  component: IssueListPage,
  validateSearch: (search) => issueSearchSchema.parse(search),
});

// ── Project type ────────────────────────────────────────────────────────

interface ProjectOutput {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

// ── Main Component ──────────────────────────────────────────────────────

function IssueListPage() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const navigate = useNavigate();

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionMode, setSelectionMode] = useState(false);

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setRowSelection({});
      return !prev;
    });
  }, []);

  const { hasFilters, clearAllFilters, apiParams } = useIssueFilters();
  const isManualSort = apiParams.sort === 'manual';

  // Fetch project info
  const projectQuery = useQuery<ProjectOutput>({
    queryKey: ['projects', projectId],
    queryFn: () => apiClient.get<ProjectOutput>(`/workspaces/${wsId}/projects/${projectId}`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch issues with infinite query
  const issuesQuery = useInfiniteQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'issues', apiParams],
    queryFn: ({ pageParam }) => {
      const params: Record<string, string> = {
        ...apiParams,
        limit: '50',
      };
      if (pageParam) {
        params.cursor = pageParam as string;
      }
      return apiClient.getList<IssueOutput>(`/projects/${projectId}/issues`, params);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_more ? (lastPage.pagination.next_cursor ?? undefined) : undefined,
  });

  const project = projectQuery.data;
  const projectPrefix = project?.prefix ?? '...';

  // Flatten all pages into a single issues array
  const issues = useMemo(
    () => issuesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [issuesQuery.data],
  );

  // Keyboard shortcut handlers
  const getIssueId = useCallback((index: number) => issues[index]?.id, [issues]);

  const handleOpenFullPage = useCallback(
    (issueId: string) => {
      navigate({
        to: '/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId',
        params: { orgSlug, wsSlug, projectId, issueId },
      });
    },
    [navigate, orgSlug, wsSlug, projectId],
  );

  const handleOpenPanel = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);
  }, []);

  const handleShowQuickAdd = useCallback(() => {
    setShowQuickAdd(true);
  }, []);

  const handleClearSelection = useCallback(() => {
    setRowSelection({});
  }, []);

  // Esc: close side panel first, then clear selection
  useHotkey(
    'escape',
    useCallback(() => {
      if (selectedIssueId) {
        setSelectedIssueId(null);
        return;
      }
      if (Object.keys(rowSelection).length > 0) {
        setRowSelection({});
      }
    }, [selectedIssueId, rowSelection]),
    { context: 'list' },
  );

  // Derive selected issue IDs for bulk actions
  const selectedIssueIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  // Register keyboard shortcuts
  useIssueListShortcuts({
    issueCount: issues.length,
    focusedIndex,
    setFocusedIndex,
    rowSelection,
    onRowSelectionChange: setRowSelection,
    getIssueId,
    onOpenFullPage: handleOpenFullPage,
    onOpenPanel: handleOpenPanel,
    onShowQuickAdd: handleShowQuickAdd,
  });

  // Loading state
  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="" actions={<Skeleton className="h-9 w-24" />} />
        <div className="flex-1 p-4">
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (projectQuery.isError || issuesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader title="Issues" />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">이슈를 불러올 수 없습니다.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                projectQuery.refetch();
                issuesQuery.refetch();
              }}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <AppHeader
        title={`${projectPrefix} Issues`}
        breadcrumbs={[{ label: project?.name ?? '' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCsvOpen(true)}
              aria-label="CSV 가져오기/내보내기"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button size="sm" onClick={() => setShowQuickAdd(true)} aria-label="이슈 추가">
              <Plus className="h-4 w-4" />
              <span>이슈</span>
            </Button>
          </div>
        }
      />

      <CsvModal projectId={projectId} open={csvOpen} onOpenChange={setCsvOpen} />

      {/* View toolbar */}
      <ViewToolbar
        totalCount={issues.length}
        selectionMode={selectionMode}
        onToggleSelectionMode={handleToggleSelectionMode}
      />

      {/* Filter bar */}
      <FilterBar />

      {/* Issue list */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-4">
          {/* Quick Add at top */}
          {showQuickAdd && (
            <div className="mb-2">
              <QuickAdd projectId={projectId} onClose={() => setShowQuickAdd(false)} />
            </div>
          )}

          {isManualSort ? (
            <IssueListTable
              issues={issues}
              projectPrefix={projectPrefix}
              projectId={projectId}
              isLoading={issuesQuery.isLoading}
              isFetchingNextPage={issuesQuery.isFetchingNextPage}
              hasNextPage={issuesQuery.hasNextPage}
              fetchNextPage={issuesQuery.fetchNextPage}
              focusedIndex={focusedIndex}
              activeIssueId={selectedIssueId}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              onRowClick={(issueId) =>
                setSelectedIssueId((prev) => (prev === issueId ? null : issueId))
              }
              onRowDoubleClick={handleOpenFullPage}
              onShowQuickAdd={() => setShowQuickAdd(true)}
              hasFilters={hasFilters}
              onClearFilters={clearAllFilters}
              isManualSort={isManualSort}
              selectionMode={selectionMode}
            />
          ) : (
            <GroupedIssuesList
              issues={issues}
              projectId={projectId}
              projectPrefix={projectPrefix}
              activeIssueId={selectedIssueId}
              onRowClick={(issueId) =>
                setSelectedIssueId((prev) => (prev === issueId ? null : issueId))
              }
              onAddIssue={() => setShowQuickAdd(true)}
              selectionMode={selectionMode}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          )}
        </div>
      </div>

      {/* Side panel for issue detail */}
      {selectedIssueId && (
        <IssueDetailPanel
          issueId={selectedIssueId}
          projectId={projectId}
          projectPrefix={projectPrefix}
          orgSlug={orgSlug}
          wsSlug={wsSlug}
          mode="panel"
          onClose={() => setSelectedIssueId(null)}
        />
      )}

      {/* Bulk action bar */}
      {selectedIssueIds.length > 0 && (
        <BulkActionBar
          projectId={projectId}
          selectedIds={selectedIssueIds}
          onClearSelection={handleClearSelection}
        />
      )}
    </div>
  );
}
