import { useState, useCallback, useRef, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import type { WikiPageOutput, WikiSpaceOutput, FileOutput } from '@worknest/shared';
import { EditorWithAutosave, SlashCommand, IssueLink, ImageUpload } from '@worknest/editor';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import { apiClient } from '@/lib/api-client';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { FileAttachment } from '@/components/file-upload/file-attachment';
import { useFileUpload } from '@/hooks/use-file-upload';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/wiki/$spaceId/$pageId',
)({
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
    queryFn: () =>
      apiClient.getList<WikiPageOutput>(`/wiki-spaces/${spaceId}/pages`),
  });

  const filesQuery = useQuery({
    queryKey: ['wiki-pages', pageId, 'files'],
    queryFn: () =>
      apiClient.getList<FileOutput>(`/wiki-pages/${pageId}/files`),
  });

  // ── Title editing ───────────────────────────────────────────────────

  const [title, setTitle] = useState('');
  const titleInitialized = useRef(false);

  useEffect(() => {
    if (pageQuery.data && !titleInitialized.current) {
      setTitle(pageQuery.data.title);
      titleInitialized.current = true;
    }
  }, [pageQuery.data]);

  // Reset when pageId changes
  useEffect(() => {
    titleInitialized.current = false;
  }, [pageId]);

  const updateTitleMutation = useMutation({
    mutationFn: (newTitle: string) =>
      apiClient.patch(`/wiki-pages/${pageId}`, { title: newTitle }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
    },
  });

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleChange = useCallback(
    (e: React.FormEvent<HTMLHeadingElement>) => {
      const newTitle = e.currentTarget.textContent ?? '';
      setTitle(newTitle);

      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
      }
      titleTimerRef.current = setTimeout(() => {
        if (newTitle.trim()) {
          updateTitleMutation.mutate(newTitle.trim());
        }
      }, 1000);
    },
    [updateTitleMutation],
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Move focus to the editor
        const editorEl = document.querySelector(
          '.ProseMirror',
        ) as HTMLElement | null;
        editorEl?.focus();
      }
    },
    [],
  );

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
    (file: FileOutput) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-pages', pageId, 'files'],
      });
    },
    [pageId, queryClient],
  );

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) =>
      apiClient.delete(`/files/${fileId}`),
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
      current = current.parentId
        ? allPages.find((p) => p.id === current!.parentId)
        : undefined;
    }
    return crumbs;
  }, [allPages, pageId]);

  // ── Render ────────────────────────────────────────────────────────

  if (pageQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pageQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">
            페이지를 불러올 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const page = pageQuery.data!;
  const space = spaceQuery.data;
  const breadcrumbPages = buildBreadcrumb();

  const editorExtensions = [
    SlashCommand,
    IssueLink,
    ImageUpload.configure({
      uploadHandler: imageUploadHandler,
    }),
  ];

  return (
    <div className="flex flex-col items-center px-6 py-4 overflow-y-auto bg-background">
      {/* Breadcrumb */}
      <div className="w-full max-w-[720px] mb-2">
        <Breadcrumb>
          <BreadcrumbList>
            {/* Space */}
            {space && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      to="/$orgSlug/$wsSlug/wiki/$spaceId"
                      params={{ orgSlug, wsSlug, spaceId }}
                    >
                      {space.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbPages.length > 0 && <BreadcrumbSeparator />}
              </>
            )}

            {/* Parent pages */}
            {breadcrumbPages.slice(0, -1).map((p, i) => (
              <span key={p.id} className="flex items-center">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      to="/$orgSlug/$wsSlug/wiki/$spaceId/$pageId"
                      params={{
                        orgSlug,
                        wsSlug,
                        spaceId,
                        pageId: p.id,
                      }}
                    >
                      {p.title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </span>
            ))}

            {/* Current page */}
            {breadcrumbPages.length > 0 && (
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {breadcrumbPages[breadcrumbPages.length - 1].title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Title */}
      <div className="w-full max-w-[720px]">
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="text-3xl font-bold text-foreground outline-none border-none py-4 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none"
          data-placeholder="제목 없음"
          onInput={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
        >
          {title}
        </h1>
      </div>

      {/* Editor */}
      <div className="w-full max-w-[720px] min-h-[calc(100vh-200px)]">
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
      <div className="w-full max-w-[720px]">
        <FileAttachment
          files={files}
          onFileUploaded={handleFileUploaded}
          onFileDelete={(fileId) => deleteFileMutation.mutate(fileId)}
        />
      </div>
    </div>
  );
}
