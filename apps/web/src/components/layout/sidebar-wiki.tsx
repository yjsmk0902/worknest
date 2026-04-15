import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import type { WikiPageOutput, WikiSpaceOutput } from '@worknest/shared';
import { ChevronDown, ChevronRight, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { CollapsedNavItem } from './sidebar-nav';

interface SidebarWikiProps {
  orgSlug: string;
  wsSlug: string;
  wsId?: string;
}

export function SidebarWiki({ orgSlug, wsSlug, wsId }: SidebarWikiProps) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());

  const spacesQuery = useQuery({
    queryKey: ['workspaces', wsId, 'wiki-spaces'],
    queryFn: () => apiClient.getList<WikiSpaceOutput>(`/workspaces/${wsId}/wiki-spaces`),
    enabled: !!wsId,
  });

  const spaces = spacesQuery.data?.data ?? [];

  const toggleExpand = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) {
        next.delete(spaceId);
      } else {
        next.add(spaceId);
      }
      return next;
    });
  };

  return (
    <>
      {/* Section header */}
      <div className="flex items-center mb-1 px-2.5">
        <button
          type="button"
          onClick={() => setSectionOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
        >
          {sectionOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Wiki
        </button>
        <Link
          to="/$orgSlug/$wsSlug/wiki"
          params={{ orgSlug, wsSlug }}
          className="ml-auto flex h-5 w-5 items-center justify-center rounded text-sidebar-foreground/30 hover:text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors"
          aria-label="스페이스 추가"
        >
          <Plus className="h-3.5 w-3.5" />
        </Link>
      </div>

      {sectionOpen && (
        <>
          {spacesQuery.isLoading && (
            <div className="space-y-1 px-2">
              <div className="h-[34px] w-full animate-pulse rounded-lg bg-sidebar-accent" />
              <div className="h-[34px] w-full animate-pulse rounded-lg bg-sidebar-accent" />
            </div>
          )}

          {spaces.map((space) => (
            <SpaceSidebarItem
              key={space.id}
              space={space}
              orgSlug={orgSlug}
              wsSlug={wsSlug}
              expanded={expandedSpaces.has(space.id)}
              onToggle={() => toggleExpand(space.id)}
            />
          ))}

          {spaces.length === 0 && (
            <Link
              to="/$orgSlug/$wsSlug/wiki"
              params={{ orgSlug, wsSlug }}
              className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>스페이스 추가</span>
            </Link>
          )}
        </>
      )}
    </>
  );
}

function SpaceSidebarItem({
  space,
  orgSlug,
  wsSlug,
  expanded,
  onToggle,
}: {
  space: WikiSpaceOutput;
  orgSlug: string;
  wsSlug: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pagesQuery = useQuery({
    queryKey: ['wiki-spaces', space.id, 'pages'],
    queryFn: () => apiClient.getList<WikiPageOutput>(`/wiki-spaces/${space.id}/pages`),
    enabled: expanded,
  });

  const rootPages = (pagesQuery.data?.data ?? []).filter((p) => !p.parentId);

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          className="flex h-[34px] w-5 items-center justify-center shrink-0 ml-1 text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors"
          onClick={onToggle}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <Link
          to="/$orgSlug/$wsSlug/wiki/$spaceId"
          params={{ orgSlug, wsSlug, spaceId: space.id }}
          className="flex h-[34px] flex-1 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:font-semibold"
        >
          <FileText className="h-4 w-4 text-sidebar-foreground/40" />
          <span className="flex-1 truncate">{space.name}</span>
        </Link>
      </div>

      {expanded && (
        <div className="ml-7 border-l border-sidebar-border pl-2 py-0.5">
          {pagesQuery.isLoading && (
            <div className="py-1 px-2">
              <div className="h-5 w-24 animate-pulse rounded bg-sidebar-accent" />
            </div>
          )}
          {rootPages.map((page) => (
            <Link
              key={page.id}
              to="/$orgSlug/$wsSlug/wiki/$spaceId/$pageId"
              params={{ orgSlug, wsSlug, spaceId: space.id, pageId: page.id }}
              className="flex h-[30px] items-center gap-2 rounded-md px-2 text-[12px] text-sidebar-foreground truncate hover:bg-sidebar-accent transition-colors data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:font-semibold"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/30" />
              <span className="truncate">{page.title}</span>
            </Link>
          ))}
          {!pagesQuery.isLoading && rootPages.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-sidebar-foreground/35">페이지 없음</p>
          )}
        </div>
      )}
    </div>
  );
}

export function CollapsedSidebarWiki() {
  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  return (
    <CollapsedNavItem
      icon={<FileText className="h-[18px] w-[18px]" />}
      label="Wiki"
      href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/wiki` : undefined}
    />
  );
}
