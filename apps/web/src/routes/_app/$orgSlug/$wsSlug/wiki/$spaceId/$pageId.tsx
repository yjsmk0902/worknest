import { FavoriteButton } from '@/components/favorite-button';
import { FileAttachment } from '@/components/file-upload/file-attachment';
import { AddCoverButton, CoverImage } from '@/components/wiki/cover-image';
import { EmojiPicker } from '@/components/wiki/emoji-picker';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { useFileUpload } from '@/hooks/use-file-upload';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type { JSONContent } from '@tiptap/core';
import {
  Bookmark,
  Callout,
  EditorWithAutosave,
  ImageUpload,
  IssueLink,
  MarkdownShortcuts,
  SlashCommand,
  ToggleBlock,
  ToggleContent,
  ToggleSummary,
} from '@worknest/editor';
import type { FileOutput, WikiPageOutput, WikiSpaceOutput } from '@worknest/shared';
import { toast } from '@worknest/ui';
import { AlertTriangle, ChevronRight, Loader2, Smile } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/wiki/$spaceId/$pageId')({
  component: WikiPageEditor,
});

function WikiPageEditor() {
  const { orgSlug, wsSlug, spaceId, pageId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // ── Queries ─────────────────────────────────────────────────────────

  const spaceQuery = useQuery<WikiSpaceOutput>({
    queryKey: ['wiki-spaces', spaceId],
    queryFn: () => apiClient.get(`/wiki-spaces/${spaceId}`),
  });

  const pageQuery = useQuery<WikiPageOutput>({
    queryKey: ['wiki-pages', pageId],
    queryFn: () => apiClient.get(`/wiki-pages/${pageId}`),
  });

  const pagesQuery = useQuery({
    queryKey: ['wiki-spaces', spaceId, 'pages'],
    queryFn: () => apiClient.getList<WikiPageOutput>(`/wiki-spaces/${spaceId}/pages`),
  });

  const filesQuery = useQuery({
    queryKey: ['wiki-pages', pageId, 'files'],
    queryFn: () => apiClient.getList<FileOutput>(`/wiki-pages/${pageId}/files`),
  });

  // ── Title editing (uncontrolled — avoid cursor jump) ─────────────────
  // Write the server title into the DOM imperatively only when pageId or
  // the initial load resolves. React never re-renders `{title}` children,
  // so typing preserves caret position.

  const titleInitializedForPageRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      pageQuery.data &&
      titleRef.current &&
      titleInitializedForPageRef.current !== pageId
    ) {
      titleRef.current.textContent = pageQuery.data.title;
      titleInitializedForPageRef.current = pageId;
    }
  }, [pageQuery.data, pageId]);

  const updateTitleMutation = useMutation({
    mutationFn: (newTitle: string) => apiClient.patch(`/wiki-pages/${pageId}`, { title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
    },
  });

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleChange = useCallback(
    (e: React.FormEvent<HTMLHeadingElement>) => {
      const el = e.currentTarget;
      const newTitle = (el.textContent ?? '').trim();

      // When the user deletes everything, browsers leave a <br> that keeps
      // `:empty` from matching — strip it so the "제목 없음" placeholder shows.
      if (newTitle === '' && el.innerHTML !== '') {
        el.innerHTML = '';
      }

      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
      }
      titleTimerRef.current = setTimeout(() => {
        updateTitleMutation.mutate(newTitle);
      }, 1000);
    },
    [updateTitleMutation],
  );

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLHeadingElement>) => {
    // Skip while an IME composition is in progress (Korean/Japanese/Chinese)
    // — Enter finishes the composition and should not jump focus yet.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to the editor
      const editorEl = document.querySelector('.ProseMirror') as HTMLElement | null;
      editorEl?.focus();
    }
  }, []);

  // ── Auto-save ───────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (json: JSONContent, _text: string) => {
      await apiClient.patch(`/wiki-pages/${pageId}`, {
        content: json,
      });
      queryClient.invalidateQueries({
        queryKey: ['wiki-pages', pageId],
      });
    },
    [pageId, queryClient],
  );

  // ── Icon + cover ────────────────────────────────────────────────────

  const updateMetaMutation = useMutation({
    mutationFn: (payload: { icon?: string | null; coverUrl?: string | null }) =>
      apiClient.patch(`/wiki-pages/${pageId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-pages', pageId] });
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
    },
    onError: () => {
      toast('저장에 실패했습니다.');
    },
  });

  const handleIconChange = useCallback(
    (icon: string | null) => {
      updateMetaMutation.mutate({ icon });
    },
    [updateMetaMutation],
  );

  const handleCoverChange = useCallback(
    (coverUrl: string | null) => {
      updateMetaMutation.mutate({ coverUrl });
    },
    [updateMetaMutation],
  );

  const coverInputRef = useRef<HTMLInputElement>(null);

  const { upload: uploadCover, uploading: uploadingCover } = useFileUpload({
    onError: (msg) => toast(msg),
  });

  const handleAddCover = useCallback(() => {
    coverInputRef.current?.click();
  }, []);

  const handleCoverFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('이미지 파일만 업로드할 수 있습니다.');
        return;
      }
      const result = await uploadCover(file);
      if (result) handleCoverChange(result.path);
    },
    [uploadCover, handleCoverChange],
  );

  // ── File upload for editor images ─────────────────────────────────

  const { upload: uploadImage } = useFileUpload({
    onError: (msg) => toast(msg),
  });

  const imageUploadHandler = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadImage(file);
      if (!result) throw new Error('Upload failed');
      return result.path;
    },
    [uploadImage],
  );

  // ── File attachments ──────────────────────────────────────────────

  const files = filesQuery.data?.data ?? [];

  const handleFileUploaded = useCallback(
    (_file: FileOutput) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-pages', pageId, 'files'],
      });
    },
    [pageId, queryClient],
  );

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => apiClient.delete(`/files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-pages', pageId, 'files'],
      });
    },
    onError: () => {
      toast('파일 삭제에 실패했습니다.');
    },
  });

  // ── Breadcrumb ────────────────────────────────────────────────────

  const allPages = pagesQuery.data?.data ?? [];

  const buildBreadcrumb = useCallback((): WikiPageOutput[] => {
    const crumbs: WikiPageOutput[] = [];
    let current = allPages.find((p) => p.id === pageId);
    while (current) {
      crumbs.unshift(current);
      current = current.parentId ? allPages.find((p) => p.id === current?.parentId) : undefined;
    }
    return crumbs;
  }, [allPages, pageId]);

  // ── Editor extensions ───────────────────────────────────────────
  // Note: page-mention ([[...]]) is temporarily disabled because multi-char
  // Suggestion triggers aren't supported by @tiptap/suggestion v2 and were
  // intercepting `/` keystrokes. Will re-enable with a single-char trigger
  // (e.g. unified `@` multi-type suggester) in a follow-up.

  const editorExtensions = useMemo(
    () => [
      SlashCommand,
      IssueLink,
      Callout,
      ToggleBlock,
      ToggleSummary,
      ToggleContent,
      MarkdownShortcuts,
      Bookmark,
      ImageUpload.configure({
        uploadHandler: imageUploadHandler,
      }),
    ],
    [imageUploadHandler],
  );

  // ── Render ────────────────────────────────────────────────────────

  if (pageQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--fg-3)]" />
      </div>
    );
  }

  if (pageQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[color:var(--priority-urgent)]" />
          <p className="mt-2 text-sm text-[color:var(--fg-3)]">페이지를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const page = pageQuery.data!;
  const space = spaceQuery.data;
  const breadcrumbPages = buildBreadcrumb();
  const currentTitle = breadcrumbPages[breadcrumbPages.length - 1]?.title;

  return (
    <div className="flex flex-col items-center overflow-y-auto bg-[color:var(--bg-0)]">
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFile}
      />

      {/* Cover image */}
      {page.coverUrl && (
        <div className="w-full">
          <CoverImage url={page.coverUrl} onChange={handleCoverChange} />
        </div>
      )}

      {/* Content wrapper */}
      <div className="flex w-full flex-col items-center px-6 pt-8 pb-8">
      {/* Icon (offset into cover when cover exists) */}
      {page.icon && (
        <div
          className={`w-full max-w-[760px] ${
            page.coverUrl ? '-mt-[68px] mb-2' : 'mb-2'
          }`}
        >
          <EmojiPicker value={page.icon} onChange={handleIconChange}>
            <button
              type="button"
              className="grid h-[68px] w-[68px] place-items-center rounded-lg bg-[color:var(--bg-1)] text-[56px] leading-none shadow-sm transition-colors hover:bg-[color:var(--bg-2)]"
              aria-label="아이콘 변경"
            >
              <span>{page.icon}</span>
            </button>
          </EmojiPicker>
        </div>
      )}

      {/* Meta actions (add icon / cover when not set) */}
      {(!page.icon || !page.coverUrl) && (
        <div className="mb-2 flex w-full max-w-[760px] items-center gap-1">
          {!page.icon && (
            <EmojiPicker value={null} onChange={handleIconChange}>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] text-[color:var(--fg-3)] transition-colors hover:bg-[color:var(--bg-2)] hover:text-[color:var(--fg-1)]"
              >
                <Smile className="h-3.5 w-3.5" />
                <span>아이콘 추가</span>
              </button>
            </EmojiPicker>
          )}
          {!page.coverUrl && (
            <AddCoverButton onAdd={handleAddCover} disabled={uploadingCover} />
          )}
        </div>
      )}

      {/* Breadcrumb + actions */}
      <div className="mb-3 flex w-full max-w-[760px] items-center gap-2">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-[color:var(--fg-3)]"
        >
          {space && (
            <>
              <Link
                to="/$orgSlug/$wsSlug/wiki/$spaceId"
                params={{ orgSlug, wsSlug, spaceId }}
                className="transition-colors hover:text-[color:var(--fg-1)]"
              >
                {space.name}
              </Link>
              {breadcrumbPages.length > 0 && (
                <ChevronRight className="h-3 w-3 text-[color:var(--fg-4)]" />
              )}
            </>
          )}
          {breadcrumbPages.slice(0, -1).map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <Link
                to="/$orgSlug/$wsSlug/wiki/$spaceId/$pageId"
                params={{ orgSlug, wsSlug, spaceId, pageId: p.id }}
                className="truncate transition-colors hover:text-[color:var(--fg-1)]"
              >
                {p.title || '제목 없음'}
              </Link>
              <ChevronRight className="h-3 w-3 text-[color:var(--fg-4)]" />
            </span>
          ))}
          {currentTitle !== undefined && (
            <span className="truncate font-medium text-[color:var(--fg-1)]">
              {currentTitle || '제목 없음'}
            </span>
          )}
        </nav>
        <FavoriteButton entityType="page" entityId={pageId} />
      </div>

      {/* Title */}
      <div className="w-full max-w-[760px]">
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="border-none py-3 text-[32px] font-semibold leading-tight text-[color:var(--fg-1)] outline-none empty:before:pointer-events-none empty:before:text-[color:var(--fg-3)] empty:before:content-[attr(data-placeholder)]"
          data-placeholder="제목 없음"
          onInput={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
        />
      </div>

      {/* Editor */}
      <div className="min-h-[calc(100vh-240px)] w-full max-w-[760px]">
        <EditorWithAutosave
          content={page.content as JSONContent | null}
          onSave={handleSave}
          debounceMs={2000}
          placeholder="/ 를 입력하여 블록을 추가하세요..."
          autofocus
          extensions={editorExtensions}
          statusLabels={{
            saved: '저장됨',
            saving: '저장 중...',
            unsaved: '저장되지 않은 변경사항',
          }}
        />
      </div>

      {/* File attachments */}
      <div className="w-full max-w-[760px]">
        <FileAttachment
          files={files}
          onFileUploaded={handleFileUploaded}
          onFileDelete={(fileId) => deleteFileMutation.mutate(fileId)}
        />
      </div>
      </div>
    </div>
  );
}
