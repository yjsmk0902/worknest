import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import type { SearchResultItem, SearchResultOutput } from '@worknest/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@worknest/ui';
import { FileText, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface PageLinkPromptDetail {
  onSubmit: (attrs: {
    pageId: string;
    spaceId: string;
    title: string;
    icon: string | null;
    href: string;
  }) => void;
}

declare global {
  interface WindowEventMap {
    'editor:page-link-request': CustomEvent<PageLinkPromptDetail>;
  }
}

/**
 * Modal that lets the user pick a wiki page to link to. A TipTap slash
 * command fires `editor:page-link-request`, we read the onSubmit callback
 * and invoke it once the user picks a page. The modal reads the workspace
 * context itself so the editor extension stays UI-agnostic.
 */
export function PageLinkModal() {
  const { wsId } = useWorkspaceContext();
  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pendingOnSubmit = useRef<PageLinkPromptDetail['onSubmit'] | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<PageLinkPromptDetail>) => {
      pendingOnSubmit.current = e.detail.onSubmit;
      setQuery('');
      setOpen(true);
    };
    window.addEventListener('editor:page-link-request', handler);
    return () => window.removeEventListener('editor:page-link-request', handler);
  }, []);

  const trimmed = query.trim();

  const resultsQuery = useQuery({
    queryKey: ['page-link-picker', wsId, trimmed],
    enabled: open && trimmed.length > 0 && !!wsId,
    queryFn: () =>
      apiClient.get<SearchResultOutput>(
        `/workspaces/${wsId}/search?type=page&limit=20&q=${encodeURIComponent(trimmed)}`,
      ),
  });

  const pages = resultsQuery.data?.categories?.pages ?? [];

  const handlePick = (item: SearchResultItem) => {
    const submit = pendingOnSubmit.current;
    if (!submit) return;
    const spaceId = item.spaceId ?? '';
    if (!spaceId || !orgSlug || !wsSlug) return;
    const href = `/${orgSlug}/${wsSlug}/wiki/${spaceId}/${item.id}`;
    submit({
      pageId: item.id,
      spaceId,
      title: item.title,
      icon: item.icon ?? null,
      href,
    });
    pendingOnSubmit.current = null;
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) pendingOnSubmit.current = null;
        setOpen(next);
      }}
    >
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>페이지 링크</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="연결할 페이지 제목을 검색하세요"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-[320px] overflow-y-auto rounded-md border border-[color:var(--border-subtle)]">
            {trimmed.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-[color:var(--fg-3)]">
                제목을 입력해 페이지를 검색하세요
              </p>
            ) : resultsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-[color:var(--fg-3)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[12.5px]">검색 중...</span>
              </div>
            ) : pages.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-[color:var(--fg-3)]">
                일치하는 페이지가 없습니다
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-subtle)]">
                {pages.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(item)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[color:var(--bg-2)]"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center text-[14px]">
                        {item.icon ? (
                          item.icon
                        ) : (
                          <FileText className="h-4 w-4 text-[color:var(--fg-3)]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[color:var(--fg-1)]">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="block truncate text-[11.5px] text-[color:var(--fg-3)]">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
