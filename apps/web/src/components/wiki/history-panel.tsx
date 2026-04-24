import { ConfirmDialog } from '@/components/confirm-dialog';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/core';
import { Editor } from '@worknest/editor';
import { Button, toast } from '@worknest/ui';
import { History, Loader2, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
}

interface RevisionSummary {
  id: string;
  pageId: string;
  title: string;
  icon: string | null;
  authorId: string | null;
  createdAt: string;
}

interface RevisionDetail extends RevisionSummary {
  content: JSONContent | null;
  contentText: string | null;
}

/**
 * Right-side slide-over showing all revisions for a page. Clicking a
 * revision loads its content in a read-only preview; "이 버전으로 복원"
 * overwrites the current page with the revision (and silently snapshots
 * the pre-restore state so the action is reversible).
 */
export function HistoryPanel({ open, onOpenChange, pageId }: HistoryPanelProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ['wiki-revisions', pageId],
    queryFn: () =>
      apiClient.getList<RevisionSummary>(`/wiki-pages/${pageId}/revisions`),
    enabled: open,
  });

  const revisions = listQuery.data?.data ?? [];

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  useEffect(() => {
    if (open && revisions.length > 0 && !selectedId) {
      setSelectedId(revisions[0]!.id);
    }
  }, [open, revisions, selectedId]);

  const detailQuery = useQuery({
    queryKey: ['wiki-revision', pageId, selectedId],
    queryFn: () =>
      apiClient.get<RevisionDetail>(
        `/wiki-pages/${pageId}/revisions/${selectedId}`,
      ),
    enabled: open && !!selectedId,
  });

  const restoreMutation = useMutation({
    mutationFn: () =>
      apiClient.post(
        `/wiki-pages/${pageId}/revisions/${selectedId}/restore`,
        {},
      ),
    onSuccess: () => {
      toast('이 버전으로 복원되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', pageId] });
      queryClient.invalidateQueries({ queryKey: ['wiki-revisions', pageId] });
      onOpenChange(false);
    },
    onError: () => toast('복원에 실패했습니다.'),
  });

  if (!open) return null;

  const formatted = (iso: string) =>
    new Date(iso).toLocaleString('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(860px,100vw)] flex-col border-l border-[color:var(--border-subtle)] bg-[color:var(--bg-0)] shadow-xl">
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[color:var(--fg-2)]" />
            <h2 className="text-[13px] font-semibold text-[color:var(--fg-1)]">편집 히스토리</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-7 w-7 place-items-center rounded-sm text-[color:var(--fg-3)] hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)]"
          >
            <X className="h-[14px] w-[14px]" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Left: revision list */}
          <div className="w-[260px] shrink-0 overflow-y-auto border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-1)]">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[color:var(--fg-3)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[12.5px]">불러오는 중...</span>
              </div>
            ) : revisions.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-[color:var(--fg-3)]">
                아직 기록된 버전이 없습니다
              </p>
            ) : (
              <ul>
                {revisions.map((rev) => {
                  const active = selectedId === rev.id;
                  return (
                    <li key={rev.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(rev.id)}
                        className={`flex w-full flex-col gap-0.5 border-l-2 px-3 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-[color:var(--accent-bg)] bg-[color:var(--accent-soft)]/40'
                            : 'border-transparent hover:bg-[color:var(--bg-2)]'
                        }`}
                      >
                        <span className="text-[12.5px] font-medium text-[color:var(--fg-1)]">
                          {formatted(rev.createdAt)}
                        </span>
                        <span className="truncate text-[11.5px] text-[color:var(--fg-3)]">
                          {rev.icon ? `${rev.icon} ` : ''}
                          {rev.title || '제목 없음'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right: selected revision preview */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[color:var(--border-subtle)] px-4">
              <div className="min-w-0">
                {detailQuery.data && (
                  <p className="truncate text-[13px] font-medium text-[color:var(--fg-1)]">
                    {detailQuery.data.icon ? `${detailQuery.data.icon} ` : ''}
                    {detailQuery.data.title || '제목 없음'}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedId || restoreMutation.isPending}
              >
                {restoreMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                <span>이 버전으로 복원</span>
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[color:var(--bg-0)] px-8 py-8">
              {detailQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[color:var(--fg-3)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[12.5px]">불러오는 중...</span>
                </div>
              ) : detailQuery.data ? (
                <Editor content={detailQuery.data.content} editable={false} />
              ) : (
                <p className="text-center text-[12.5px] text-[color:var(--fg-3)]">
                  버전을 선택하세요
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="이 버전으로 복원"
        description="현재 내용은 자동으로 히스토리에 스냅샷되어 다시 되돌릴 수 있습니다. 계속할까요?"
        confirmText="복원"
        onConfirm={async () => {
          await restoreMutation.mutateAsync();
        }}
      />
    </>
  );
}
