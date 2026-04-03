import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Avatar, Skeleton } from '@worknest/ui';
import { apiClient, type ListResponse } from '../../lib/api-client';
import { QuickAdd } from './quick-add';
import type { IssueOutput } from '@worknest/shared';

interface SubIssuesProps {
  projectId: string;
  issueId: string;
  projectPrefix: string;
  orgSlug: string;
  wsSlug: string;
}

export function SubIssues({
  projectId,
  issueId,
  projectPrefix,
  orgSlug,
  wsSlug,
}: SubIssuesProps) {
  const [expanded, setExpanded] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const subIssuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'issues', issueId, 'sub-issues'],
    queryFn: () =>
      apiClient.getList<IssueOutput>(
        `/projects/${projectId}/issues/${issueId}/sub-issues`,
      ),
  });

  const subIssues = subIssuesQuery.data?.data ?? [];
  const completedCount = subIssues.filter(
    (issue) =>
      issue.status?.name === 'Done' || issue.status?.name === 'Cancelled',
  ).length;
  const totalCount = subIssues.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (subIssuesQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // Don't show section if no sub-issues and quick add is not active
  if (totalCount === 0 && !showQuickAdd) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>서브이슈 추가</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-foreground/80"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>서브이슈</span>
          <span className="text-muted-foreground">
            ({completedCount}/{totalCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
          aria-label="서브이슈 추가"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
      )}

      {/* Sub-issue list */}
      {expanded && (
        <div className="space-y-0.5">
          {subIssues.map((issue) => {
            const isTemp = issue.id.startsWith('temp-');
            const issueKey = isTemp
              ? '...'
              : `${projectPrefix}-${issue.sequenceId}`;

            return (
              <Link
                key={issue.id}
                to="/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId"
                params={{
                  orgSlug,
                  wsSlug,
                  projectId,
                  issueId: issue.id,
                }}
                className={`flex h-8 items-center gap-2 rounded px-2 text-sm hover:bg-accent ${
                  isTemp ? 'pointer-events-none opacity-70' : ''
                }`}
                aria-busy={isTemp}
                aria-label={isTemp ? '생성 중...' : undefined}
              >
                {/* Status dot */}
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: issue.status?.color ?? '#94a3b8',
                  }}
                />

                {/* Issue key */}
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {issueKey}
                </span>

                {/* Title */}
                <span className="flex-1 truncate">{issue.title}</span>

                {/* Assignee avatar */}
                {issue.assignees && issue.assignees.length > 0 && (
                  <Avatar
                    src={issue.assignees[0].user.avatarUrl}
                    fallback={issue.assignees[0].user.name}
                    size="sm"
                  />
                )}
              </Link>
            );
          })}

          {/* Quick Add for sub-issues */}
          {showQuickAdd && (
            <QuickAdd
              projectId={projectId}
              parentId={issueId}
              onClose={() => setShowQuickAdd(false)}
            />
          )}

          {/* Add button at bottom */}
          {!showQuickAdd && (
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>서브이슈 추가</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
