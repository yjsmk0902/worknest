import { useCallback, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Star,
  GripVertical,
  Folder,
  CircleCheck,
  FileText,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { Skeleton, toast } from '@worknest/ui';
import {
  generateKeyBetween,
  type FavoriteOutput,
  type FavoriteEntityType,
} from '@worknest/shared';
import { apiClient } from '../../../../../lib/api-client';
import { useWorkspaceContext } from '../../../../../contexts/workspace-context';

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/my/favorites',
)({
  component: FavoritesPage,
});

// ── Entity type display config ─────────────────────────────────────────

const ENTITY_TYPE_CONFIG: Record<
  FavoriteEntityType,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  project: { icon: Folder, label: '프로젝트' },
  issue: { icon: CircleCheck, label: '이슈' },
  page: { icon: FileText, label: 'Wiki 페이지' },
  space: { icon: BookOpen, label: 'Wiki 스페이스' },
};

// ── Sortable Item ──────────────────────────────────────────────────────

interface SortableFavoriteItemProps {
  favorite: FavoriteOutput;
  onUnfavorite: (id: string) => void;
  onClick: (favorite: FavoriteOutput) => void;
}

function SortableFavoriteItem({
  favorite,
  onUnfavorite,
  onClick,
}: SortableFavoriteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: favorite.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const entityConfig = ENTITY_TYPE_CONFIG[favorite.entityType];
  const EntityIcon = entityConfig.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      className={`flex h-11 cursor-pointer items-center gap-3 rounded-md border-b border-border/50 px-4 transition-colors hover:bg-accent/50 ${
        isDragging ? 'scale-[1.01] opacity-85 shadow-lg' : ''
      }`}
      onClick={() => onClick(favorite)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick(favorite);
      }}
      tabIndex={0}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        aria-roledescription="드래그 가능한 즐겨찾기"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Entity icon */}
      <EntityIcon className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Entity name */}
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {favorite.entityName}
      </span>

      {/* Entity type badge */}
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {entityConfig.label}
      </span>

      {/* Unfavorite star */}
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md hover:text-yellow-400"
        onClick={(e) => {
          e.stopPropagation();
          onUnfavorite(favorite.id);
        }}
        aria-label="즐겨찾기 해제"
      >
        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
      </button>
    </div>
  );
}

// ── Drag Overlay Item ──────────────────────────────────────────────────

function DragOverlayItem({ favorite }: { favorite: FavoriteOutput }) {
  const entityConfig = ENTITY_TYPE_CONFIG[favorite.entityType];
  const EntityIcon = entityConfig.icon;

  return (
    <div className="flex h-11 items-center gap-3 rounded-md border border-border bg-background px-4 shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      <EntityIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {favorite.entityName}
      </span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {entityConfig.label}
      </span>
      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

function FavoritesPage() {
  const { orgSlug, wsSlug } = Route.useParams();
  useWorkspaceContext(); // Ensure workspace context is available
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);

  // Fetch favorites
  const favoritesQuery = useQuery<FavoriteOutput[]>({
    queryKey: ['my', 'favorites'],
    queryFn: () => apiClient.get<FavoriteOutput[]>('/my/favorites'),
    staleTime: 30 * 1000,
  });

  // Delete favorite mutation
  const deleteMutation = useMutation({
    mutationFn: (favoriteId: string) =>
      apiClient.delete(`/favorites/${favoriteId}`),
    onMutate: async (favoriteId) => {
      await queryClient.cancelQueries({ queryKey: ['my', 'favorites'] });
      const previousData = queryClient.getQueryData<FavoriteOutput[]>([
        'my',
        'favorites',
      ]);

      queryClient.setQueryData<FavoriteOutput[]>(
        ['my', 'favorites'],
        (old) => old?.filter((f) => f.id !== favoriteId) ?? [],
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my', 'favorites'], context.previousData);
      }
      toast('즐겨찾기 해제에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'favorites'] });
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (data: { favoriteId: string; sortOrder: string }) =>
      apiClient.patch(`/favorites/${data.favoriteId}`, {
        sortOrder: data.sortOrder,
      }),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'favorites'] });
      toast('순서 변경에 실패했습니다.');
    },
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // DnD handlers
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const items = favoritesQuery.data ?? [];
      const oldIndex = items.findIndex((f) => f.id === active.id);
      const newIndex = items.findIndex((f) => f.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Compute new sortOrder using fractional indexing
      const above = newIndex > 0 ? items[newIndex > oldIndex ? newIndex : newIndex - 1] : null;
      const below =
        newIndex < items.length - 1
          ? items[newIndex < oldIndex ? newIndex : newIndex + 1]
          : null;

      // When moving down, we insert after the target; when moving up, before the target.
      let newSortOrder: string;
      if (newIndex > oldIndex) {
        // Moving down: place after the target item
        const target = items[newIndex];
        const nextItem = newIndex + 1 < items.length ? items[newIndex + 1] : null;
        newSortOrder = generateKeyBetween(
          target.sortOrder,
          nextItem?.sortOrder ?? null,
        );
      } else {
        // Moving up: place before the target item
        const target = items[newIndex];
        const prevItem = newIndex - 1 >= 0 ? items[newIndex - 1] : null;
        newSortOrder = generateKeyBetween(
          prevItem?.sortOrder ?? null,
          target.sortOrder,
        );
      }

      // Optimistic reorder
      const movedItem = items[oldIndex];
      const newItems = items.filter((_, i) => i !== oldIndex);
      const updatedItem = { ...movedItem, sortOrder: newSortOrder };

      // Insert at new position
      const insertIndex = newIndex > oldIndex ? newIndex : newIndex;
      newItems.splice(
        insertIndex > newItems.length ? newItems.length : insertIndex,
        0,
        updatedItem,
      );

      // Sort by sortOrder to ensure consistency
      newItems.sort((a, b) => a.sortOrder.localeCompare(b.sortOrder));

      queryClient.setQueryData(['my', 'favorites'], newItems);

      // API call
      reorderMutation.mutate({
        favoriteId: movedItem.id,
        sortOrder: newSortOrder,
      });
    },
    [favoritesQuery.data, queryClient, reorderMutation],
  );

  // Navigate to entity
  const handleItemClick = useCallback(
    (favorite: FavoriteOutput) => {
      // Navigate based on entity type
      // Since the favorite only has entity IDs, we navigate to the most
      // appropriate route. For projects, we need the projectId. For issues,
      // we need projectId + issueId, etc.
      if (favorite.projectId) {
        navigate({
          to: '/$orgSlug/$wsSlug/projects/$projectId/issues',
          params: {
            orgSlug,
            wsSlug,
            projectId: favorite.projectId,
          },
        });
      } else if (favorite.spaceId) {
        navigate({
          to: '/$orgSlug/$wsSlug/wiki/$spaceId',
          params: {
            orgSlug,
            wsSlug,
            spaceId: favorite.spaceId,
          },
        });
      }
      // For issues and pages, we'd need additional metadata to navigate
      // properly (project prefix, space ID, etc.)
    },
    [navigate, orgSlug, wsSlug],
  );

  // Active item for drag overlay
  const activeItem = activeId
    ? favoritesQuery.data?.find((f) => f.id === activeId) ?? null
    : null;

  // Loading state
  if (favoritesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">즐겨찾기</h1>
        </div>
        <div
          className="space-y-0 px-6"
          aria-busy="true"
          aria-label="즐겨찾기 로딩 중"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="flex h-11 items-center gap-3 border-b border-border/50 px-4"
            >
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (favoritesQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">즐겨찾기</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              즐겨찾기를 불러올 수 없습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const favorites = favoritesQuery.data ?? [];

  // Empty state
  if (favorites.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold">즐겨찾기</h1>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16">
          <Star className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">즐겨찾기한 항목이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            프로젝트, 이슈, Wiki 페이지에서 ⭐를 눌러 즐겨찾기에 추가하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-6 py-4">
        <h1 className="text-2xl font-semibold">즐겨찾기</h1>
      </div>

      {/* Favorites list with DnD */}
      <div className="flex-1 overflow-y-auto px-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => setActiveId(event.active.id as string)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={favorites.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div role="list" aria-label="즐겨찾기 목록">
              {favorites.map((favorite) => (
                <SortableFavoriteItem
                  key={favorite.id}
                  favorite={favorite}
                  onUnfavorite={(id) => deleteMutation.mutate(id)}
                  onClick={handleItemClick}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? <DragOverlayItem favorite={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
