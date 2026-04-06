import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from '@worknest/ui';
import type { WikiSpaceOutput, WikiPageOutput } from '@worknest/shared';
import { apiClient } from '../../lib/api-client';
import { NavItem, CollapsedNavItem, SectionLabel } from './sidebar-nav';

interface SidebarWikiProps {
  orgSlug: string;
  wsSlug: string;
  wsId?: string;
}

/**
 * Wiki section in the sidebar.
 *
 * Fetches wiki spaces from the API and renders them as expandable items.
 * Each space can be expanded to show its top-level page titles.
 */
export function SidebarWiki({
  orgSlug,
  wsSlug,
  wsId,
}: SidebarWikiProps) {
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(
    new Set(),
  );

  const spacesQuery = useQuery({
    queryKey: ['workspaces', wsId, 'wiki-spaces'],
    queryFn: () =>
      apiClient.getList<WikiSpaceOutput>(
        `/workspaces/${wsId}/wiki-spaces`,
      ),
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
      <SectionLabel>Wiki</SectionLabel>

      {/* Loading skeleton */}
      {spacesQuery.isLoading && (
        <div className="space-y-1 px-3">
          <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
        </div>
      )}

      {/* Space list */}
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

      {/* Add space button */}
      <Link
        to="/$orgSlug/$wsSlug/wiki"
        params={{ orgSlug, wsSlug }}
        className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        <span>스페이스 추가</span>
      </Link>
    </>
  );
}

// ── Space sidebar item with expandable pages ────────────────────────────

interface SpaceSidebarItemProps {
  space: WikiSpaceOutput;
  orgSlug: string;
  wsSlug: string;
  expanded: boolean;
  onToggle: () => void;
}

function SpaceSidebarItem({
  space,
  orgSlug,
  wsSlug,
  expanded,
  onToggle,
}: SpaceSidebarItemProps) {
  // Only fetch pages when expanded
  const pagesQuery = useQuery({
    queryKey: ['wiki-spaces', space.id, 'pages'],
    queryFn: () =>
      apiClient.getList<WikiPageOutput>(
        `/wiki-spaces/${space.id}/pages`,
      ),
    enabled: expanded,
  });

  const rootPages = (pagesQuery.data?.data ?? []).filter(
    (p) => !p.parentId,
  );

  return (
    <div>
      {/* Space item */}
      <div className="flex items-center">
        <button
          type="button"
          className="flex h-8 w-6 items-center justify-center shrink-0 ml-1"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        </button>
        <Link
          to="/$orgSlug/$wsSlug/wiki/$spaceId"
          params={{ orgSlug, wsSlug, spaceId: space.id }}
          className="flex h-8 flex-1 items-center gap-2 rounded-md px-1 text-sm transition-colors hover:bg-sidebar-accent"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{space.name}</span>
        </Link>
      </div>

      {/* Expanded page list */}
      {expanded && (
        <div className="ml-2">
          {pagesQuery.isLoading && (
            <div className="pl-6 py-1">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            </div>
          )}
          {rootPages.map((page) => (
            <Link
              key={page.id}
              to="/$orgSlug/$wsSlug/wiki/$spaceId/$pageId"
              params={{
                orgSlug,
                wsSlug,
                spaceId: space.id,
                pageId: page.id,
              }}
              className="flex h-7 items-center gap-2 rounded-sm pl-6 pr-2 text-sm truncate hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{page.title}</span>
            </Link>
          ))}
          {expanded && !pagesQuery.isLoading && rootPages.length === 0 && (
            <p className="pl-6 py-1 text-xs text-muted-foreground">
              페이지 없음
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function CollapsedSidebarWiki() {
  return (
    <>
      <CollapsedNavItem
        icon={<FileText className="h-5 w-5" />}
        label="Wiki"
      />
    </>
  );
}
