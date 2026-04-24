import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { JSONContent } from '@tiptap/core';
import {
  Bookmark,
  Callout,
  Editor,
  IssueLink,
  PageLink,
  createUniversalMentionExtension,
} from '@worknest/editor';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

interface PublicPagePayload {
  id: string;
  title: string;
  icon: string | null;
  content: JSONContent | null;
  updatedAt: string;
  spaceName: string | null;
  expiresAt: string | null;
}

async function fetchPublicPage(token: string): Promise<PublicPagePayload> {
  const res = await fetch(`/api/v1/wiki-share/${encodeURIComponent(token)}`, {
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json();
}

export const Route = createFileRoute('/wiki-share/$token')({
  component: WikiSharePage,
});

function WikiSharePage() {
  const { token } = Route.useParams();

  // Read-only render needs every node type the document might contain.
  // No-op queryFn/resolveHref for the universal-mention extension since this
  // page can't run an authenticated search — the stored `href` attribute is
  // still rendered as-is, so existing mentions navigate correctly.
  const readOnlyExtensions = useMemo(
    () => [
      IssueLink,
      Callout,
      Bookmark,
      PageLink,
      createUniversalMentionExtension({
        queryFn: async () => [],
        resolveHref: () => '#',
      }),
    ],
    [],
  );

  const pageQuery = useQuery({
    queryKey: ['wiki-share', token],
    queryFn: () => fetchPublicPage(token),
    retry: false,
  });

  if (pageQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-0)]">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--fg-3)]" />
      </div>
    );
  }

  if (pageQuery.isError || !pageQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg-0)]">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[color:var(--priority-urgent)]" />
          <p className="mt-3 text-base font-medium text-[color:var(--fg-1)]">
            공유 링크가 유효하지 않습니다
          </p>
          <p className="mt-1 text-[13px] text-[color:var(--fg-3)]">
            만료되었거나 해제된 링크일 수 있습니다. 문서 소유자에게 새 링크를 요청하세요.
          </p>
        </div>
      </div>
    );
  }

  const page = pageQuery.data;
  const updatedAtLabel = new Date(page.updatedAt).toLocaleString('ko-KR');

  return (
    <div className="min-h-screen bg-[color:var(--bg-0)]">
      <header className="border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-1)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-6 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-[color:var(--fg-3)]">
            <span className="rounded-md bg-[color:var(--bg-3)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--fg-2)]">
              공유 링크
            </span>
            {page.spaceName && (
              <>
                <span className="text-[color:var(--fg-4)]">·</span>
                <span className="truncate">{page.spaceName}</span>
              </>
            )}
          </div>
          <span className="text-[11.5px] text-[color:var(--fg-3)]">
            마지막 수정: {updatedAtLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-col px-6 pt-10 pb-24">
        <div className="mb-4 flex items-center gap-3">
          {page.icon && (
            <span className="grid h-10 w-10 place-items-center text-[28px]">
              {page.icon}
            </span>
          )}
          <h1 className="text-[32px] font-semibold leading-tight text-[color:var(--fg-1)]">
            {page.title || '제목 없음'}
          </h1>
        </div>

        <Editor
          content={page.content}
          editable={false}
          extensions={readOnlyExtensions}
        />

        {page.expiresAt && (
          <p className="mt-10 text-[11.5px] text-[color:var(--fg-3)]">
            이 링크는 {new Date(page.expiresAt).toLocaleString('ko-KR')}에 만료됩니다.
          </p>
        )}
      </main>
    </div>
  );
}
