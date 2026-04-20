import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { JSONContent, MentionQueryFn, MentionUser } from '@worknest/editor';
import { EditorWithAutosave } from '@worknest/editor';
import type { IssueOutput } from '@worknest/shared';
import { Button, ScrollArea, Separator, Skeleton } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { AlertTriangle, ArrowLeft, Maximize2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { CommentList } from '../../comments/comment-list';
import { SubIssues } from '../sub-issues';
import { IssueProperties } from './issue-properties';

// ── Member type for mention suggestions ────────────────────────────────

interface MemberOutput {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

function createProjectMentionQueryFn(projectId: string): MentionQueryFn {
  return async (query: string): Promise<MentionUser[]> => {
    const result = await apiClient.getList<MemberOutput>(`/projects/${projectId}/members`);
    const members = result.data ?? [];
    const lower = query.toLowerCase();
    return members
      .filter(
        (m) =>
          m.user.name.toLowerCase().includes(lower) || m.user.email.toLowerCase().includes(lower),
      )
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl ?? undefined,
        email: m.user.email,
      }));
  };
}

interface IssueDetailPanelProps {
  issueId: string;
  projectId: string;
  projectPrefix: string;
  orgSlug: string;
  wsSlug: string;
  mode: 'panel' | 'full-page';
  onClose?: () => void;
}

export function IssueDetailPanel({
  issueId,
  projectId,
  projectPrefix,
  orgSlug,
  wsSlug,
  mode,
  onClose,
}: IssueDetailPanelProps) {
  const queryClient = useQueryClient();

  const mentionQueryFn = useMemo(() => createProjectMentionQueryFn(projectId), [projectId]);

  const issueQuery = useQuery<IssueOutput>({
    queryKey: ['projects', projectId, 'issues', issueId],
    queryFn: () => apiClient.get<IssueOutput>(`/projects/${projectId}/issues/${issueId}`),
  });

  const saveDescription = useCallback(
    async (json: JSONContent, text: string) => {
      await apiClient.patch(`/projects/${projectId}/issues/${issueId}`, {
        description: json,
        descriptionText: text,
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issueId],
      });
    },
    [projectId, issueId, queryClient],
  );

  // Close on Escape
  useEffect(() => {
    if (mode !== 'panel') return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, onClose]);

  if (issueQuery.isLoading) {
    return mode === 'panel' ? <PanelSkeleton /> : <FullPageSkeleton />;
  }

  if (issueQuery.isError) {
    return (
      <div
        className={cn(
          mode === 'panel' && 'w-[640px] border-l border-border bg-background',
          'flex h-full items-center justify-center',
        )}
      >
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">이슈를 불러올 수 없습니다.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => issueQuery.refetch()}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const issue = issueQuery.data!;
  const issueKey = `${projectPrefix}-${issue.sequenceId}`;

  if (mode === 'panel') {
    return (
      <>
        {/* Subtle backdrop — click to close */}
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="fixed inset-0 z-30 cursor-default bg-[rgba(0,0,0,0.25)] backdrop-blur-[2px]"
        />
        <div className="fixed inset-y-0 right-0 z-40 flex w-[640px] flex-col border-l border-[color:var(--border)] bg-[color:var(--bg-1)] shadow-[var(--shadow-lg)]">
        {/* Panel Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-4">
          <Link
            to="/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId"
            params={{ orgSlug, wsSlug, projectId, issueId }}
            className="text-sm font-mono text-muted-foreground hover:text-foreground"
          >
            {issueKey}
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/$orgSlug/$wsSlug/projects/$projectId/issues/$issueId"
              params={{ orgSlug, wsSlug, projectId, issueId }}
            >
              <Button variant="ghost" size="sm" aria-label="전체 화면으로 열기">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="닫기 (Esc)">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Properties (compact) */}
        <IssueProperties
          issue={issue}
          projectId={projectId}
          mode="panel"
          orgSlug={orgSlug}
          wsSlug={wsSlug}
        />

        {/* Body (scrollable) */}
        <ScrollArea className="flex-1 px-4 py-4">
          {/* Title (inline editable) */}
          <InlineEditableTitle issueId={issue.id} projectId={projectId} title={issue.title} />

          <Separator className="my-4" />

          {/* Description */}
          <EditorWithAutosave
            content={issue.description as JSONContent | null}
            onSave={saveDescription}
            placeholder="설명을 추가하세요..."
            className="min-h-[100px]"
            statusLabels={{ saved: '저장됨', saving: '저장 중...', unsaved: '변경사항 있음' }}
          />

          <Separator className="my-4" />

          {/* Sub-issues */}
          <SubIssues
            projectId={projectId}
            issueId={issue.id}
            projectPrefix={projectPrefix}
            orgSlug={orgSlug}
            wsSlug={wsSlug}
          />

          <Separator className="my-4" />

          {/* Comments & Activity */}
          <CommentList issueId={issue.id} projectId={projectId} mentionQueryFn={mentionQueryFn} />
        </ScrollArea>
        </div>
      </>
    );
  }

  // Full page mode
  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-6">
        <Link
          to="/$orgSlug/$wsSlug/projects/$projectId/issues"
          params={{ orgSlug, wsSlug, projectId }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{projectPrefix} Issues</span>
        </Link>
        <span className="text-sm font-mono text-muted-foreground">{issueKey}</span>
      </div>

      {/* Content: body + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <ScrollArea className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-3xl">
            {/* Title (inline editable) */}
            <InlineEditableTitle issueId={issue.id} projectId={projectId} title={issue.title} />

            <Separator className="my-4" />

            {/* Description */}
            <EditorWithAutosave
              content={issue.description as JSONContent | null}
              onSave={saveDescription}
              placeholder="설명을 추가하세요..."
              className="min-h-[200px]"
              statusLabels={{ saved: '저장됨', saving: '저장 중...', unsaved: '변경사항 있음' }}
            />

            <Separator className="my-4" />

            {/* Sub-issues */}
            <SubIssues
              projectId={projectId}
              issueId={issue.id}
              projectPrefix={projectPrefix}
              orgSlug={orgSlug}
              wsSlug={wsSlug}
            />

            <Separator className="my-4" />

            {/* Comments & Activity */}
            <CommentList issueId={issue.id} projectId={projectId} mentionQueryFn={mentionQueryFn} />
          </div>
        </ScrollArea>

        {/* Properties sidebar */}
        <IssueProperties
          issue={issue}
          projectId={projectId}
          mode="sidebar"
          orgSlug={orgSlug}
          wsSlug={wsSlug}
        />
      </div>
    </div>
  );
}

// ── Inline Editable Title ───────────────────────────────────────────────

function InlineEditableTitle({
  issueId,
  projectId,
  title,
}: {
  issueId: string;
  projectId: string;
  title: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (newTitle: string) =>
      apiClient.patch(`/projects/${projectId}/issues/${issueId}`, {
        title: newTitle,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues', issueId],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
    },
  });

  const startEditing = useCallback(() => {
    setEditValue(title);
    setEditing(true);
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [title]);

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      updateMutation.mutate(trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(title);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full text-lg font-semibold outline-none ring-2 ring-ring rounded-md px-2 py-1 bg-transparent"
      />
    );
  }

  return (
    <h2
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter') startEditing();
      }}
      className="cursor-pointer rounded-md px-2 py-1 text-lg font-semibold hover:bg-accent"
    >
      {title}
    </h2>
  );
}

// ── Skeletons ───────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[640px] flex-col border-l border-border bg-background shadow-lg">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      {/* Properties */}
      <div className="space-y-2 border-b border-border px-4 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-40" />
          </div>
        ))}
      </div>
      {/* Body */}
      <div className="flex-1 space-y-4 px-4 py-4">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

function FullPageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      {/* Content */}
      <div className="flex flex-1">
        <div className="flex-1 space-y-4 px-6 py-6">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="w-[240px] space-y-4 border-l border-border p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1 h-3 w-16" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
