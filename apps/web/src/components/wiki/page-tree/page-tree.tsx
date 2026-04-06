import { useState, useCallback, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from '@worknest/ui';
import type { WikiPageOutput } from '@worknest/shared/schemas/wiki';
import { apiClient } from '../../../lib/api-client';
import { PageTreeItem } from './page-tree-item';

interface PageTreeProps {
  spaceId: string;
  pages: WikiPageOutput[];
  isLoading: boolean;
  onPageSelect: (pageId: string) => void;
  orgSlug: string;
  wsSlug: string;
}

interface TreeNode {
  page: WikiPageOutput;
  children: TreeNode[];
  level: number;
}

/**
 * Build a flat list of tree nodes from pages, ordered hierarchically.
 */
function buildTree(
  pages: WikiPageOutput[],
  parentId: string | null,
  level: number,
): TreeNode[] {
  return pages
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.sortOrder.localeCompare(b.sortOrder))
    .map((page) => ({
      page,
      children: buildTree(pages, page.id, level + 1),
      level,
    }));
}

/**
 * Flatten tree nodes into a list, respecting expanded state.
 */
function flattenTree(
  nodes: TreeNode[],
  expanded: Set<string>,
): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (expanded.has(node.page.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expanded));
    }
  }
  return result;
}

/**
 * Check if a page has children in the tree.
 */
function hasChildren(pages: WikiPageOutput[], pageId: string): boolean {
  return pages.some((p) => p.parentId === pageId);
}

// ── Sortable wrapper ────────────────────────────────────────────────────

function SortablePageItem({
  node,
  isSelected,
  isExpanded,
  pages,
  onToggle,
  onClick,
}: {
  node: TreeNode;
  isSelected: boolean;
  isExpanded: boolean;
  pages: WikiPageOutput[];
  onToggle: () => void;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <PageTreeItem
        page={node.page}
        level={node.level}
        isSelected={isSelected}
        hasChildren={hasChildren(pages, node.page.id)}
        isExpanded={isExpanded}
        onToggle={onToggle}
        onClick={onClick}
        dragHandleProps={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}

// ── Page Tree ───────────────────────────────────────────────────────────

/**
 * Hierarchical page list with indentation.
 *
 * Supports expand/collapse, current page highlight,
 * drag-and-drop reorder, and a "new page" button at the bottom.
 */
export function PageTree({
  spaceId,
  pages,
  isLoading,
  onPageSelect,
  orgSlug,
  wsSlug,
}: PageTreeProps) {
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { pageId?: string };
  const currentPageId = params.pageId;

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpand = useCallback((pageId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const tree = useMemo(
    () => buildTree(pages, null, 0),
    [pages],
  );

  const flatNodes = useMemo(
    () => flattenTree(tree, expanded),
    [tree, expanded],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // Move page mutation
  const moveMutation = useMutation({
    mutationFn: ({
      pageId,
      sortOrder,
      parentId,
    }: {
      pageId: string;
      sortOrder?: string;
      parentId?: string | null;
    }) =>
      apiClient.patch(`/wiki-pages/${pageId}`, { sortOrder, parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
    },
    onError: () => {
      toast('페이지 이동에 실패했습니다.');
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
    },
  });

  // Create page mutation
  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<WikiPageOutput>(`/wiki-spaces/${spaceId}/pages`, {
        title: '새 페이지',
        slug: `page-${Date.now()}`,
      }),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'pages'],
      });
      onPageSelect(newPage.id);
    },
    onError: () => {
      toast('페이지 생성에 실패했습니다.');
    },
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find positions in flat list
      const activeIndex = flatNodes.findIndex(
        (n) => n.page.id === activeId,
      );
      const overIndex = flatNodes.findIndex(
        (n) => n.page.id === overId,
      );

      if (activeIndex === -1 || overIndex === -1) return;

      const overNode = flatNodes[overIndex];

      // Simple reorder: move active to the position of over
      moveMutation.mutate({
        pageId: activeId,
        parentId: overNode.page.parentId,
        sortOrder: overNode.page.sortOrder,
      });
    },
    [flatNodes, moveMutation],
  );

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" role="tree">
      {/* Tree items */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {flatNodes.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            페이지가 없습니다
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flatNodes.map((n) => n.page.id)}
              strategy={verticalListSortingStrategy}
            >
              {flatNodes.map((node) => (
                <SortablePageItem
                  key={node.page.id}
                  node={node}
                  isSelected={currentPageId === node.page.id}
                  isExpanded={expanded.has(node.page.id)}
                  pages={pages}
                  onToggle={() => toggleExpand(node.page.id)}
                  onClick={() => onPageSelect(node.page.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* New page button */}
      <div className="mt-auto border-t border-border p-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          새 페이지
        </button>
      </div>
    </div>
  );
}
