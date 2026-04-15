import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFavoriteInput, FavoriteEntityType, FavoriteOutput } from '@worknest/shared';
import { Button, toast } from '@worknest/ui';
import { Star } from 'lucide-react';
import { useCallback } from 'react';
import { apiClient } from '../lib/api-client';

// ── Props ──────────────────────────────────────────────────────────────

interface FavoriteButtonProps {
  entityType: FavoriteEntityType;
  entityId: string;
  className?: string;
  size?: 'sm' | 'default';
}

// ── Component ──────────────────────────────────────────────────────────

/**
 * Star icon toggle button for adding/removing favorites.
 *
 * Uses optimistic updates for immediate UI feedback.
 * Can be used on project cards, issue detail, wiki pages, and wiki spaces.
 */
export function FavoriteButton({
  entityType,
  entityId,
  className,
  size = 'sm',
}: FavoriteButtonProps) {
  const queryClient = useQueryClient();

  // Check if this entity is already favorited by looking at the favorites list
  const favoritesQuery = useQuery<FavoriteOutput[]>({
    queryKey: ['my', 'favorites'],
    queryFn: () => apiClient.get<FavoriteOutput[]>('/my/favorites'),
    staleTime: 60 * 1000,
  });

  // Find the existing favorite entry for this entity
  const existingFavorite = favoritesQuery.data?.find((f) => {
    switch (entityType) {
      case 'project':
        return f.projectId === entityId;
      case 'issue':
        return f.issueId === entityId;
      case 'page':
        return f.pageId === entityId;
      case 'space':
        return f.spaceId === entityId;
      default:
        return false;
    }
  });

  const isFavorited = !!existingFavorite;

  // Add favorite mutation
  const addMutation = useMutation({
    mutationFn: (input: CreateFavoriteInput) =>
      apiClient.post<FavoriteOutput>('/my/favorites', input),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['my', 'favorites'] });
      const previousData = queryClient.getQueryData<FavoriteOutput[]>(['my', 'favorites']);

      // Optimistic: add a temporary favorite entry
      const tempFavorite: FavoriteOutput = {
        id: `temp-${entityId}`,
        userId: '',
        projectId: entityType === 'project' ? entityId : null,
        issueId: entityType === 'issue' ? entityId : null,
        pageId: entityType === 'page' ? entityId : null,
        spaceId: entityType === 'space' ? entityId : null,
        entityType,
        entityName: '', // Will be resolved on server response
        sortOrder: 'z0', // Temporary sort order at the end
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<FavoriteOutput[]>(['my', 'favorites'], (old) => [
        ...(old ?? []),
        tempFavorite,
      ]);

      return { previousData };
    },
    onError: (_err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['my', 'favorites'], context.previousData);
      }
      toast.error('즐겨찾기 추가에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'favorites'] });
    },
  });

  // Remove favorite mutation
  const removeMutation = useMutation({
    mutationFn: (favoriteId: string) => apiClient.delete(`/favorites/${favoriteId}`),
    onMutate: async (favoriteId) => {
      await queryClient.cancelQueries({ queryKey: ['my', 'favorites'] });
      const previousData = queryClient.getQueryData<FavoriteOutput[]>(['my', 'favorites']);

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
      toast.error('즐겨찾기 해제에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'favorites'] });
    },
  });

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (isFavorited && existingFavorite) {
        removeMutation.mutate(existingFavorite.id);
      } else {
        addMutation.mutate({ entityType, entityId });
      }
    },
    [isFavorited, existingFavorite, removeMutation, addMutation, entityType, entityId],
  );

  const isPending = addMutation.isPending || removeMutation.isPending;

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'default'}
      className={className}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      aria-pressed={isFavorited}
    >
      <Star
        className={`h-4 w-4 ${
          isFavorited
            ? 'fill-yellow-500 text-yellow-500'
            : 'text-muted-foreground hover:text-yellow-400'
        }`}
      />
    </Button>
  );
}
