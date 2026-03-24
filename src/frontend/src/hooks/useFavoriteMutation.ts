import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import * as favoriteService from '@/services/api/favoriteService';

export function useFavoriteMutation(
  entryId: string | undefined,
  isFavorited: boolean,
  activeTabId?: string
) {
  const queryClient = useQueryClient();

  const favoriteMutation = useMutation({
    mutationFn: (currentlyFavorited: boolean) =>
      currentlyFavorited
        ? favoriteService.unfavoriteEntry(entryId!)
        : favoriteService.favoriteEntry(entryId!),
    onMutate: async (currentlyFavorited) => {
      const queryKey = activeTabId
        ? ['entry', entryId, 'tab', activeTabId]
        : ['entry', entryId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: Record<string, unknown> | undefined) =>
        old ? { ...old, isFavorited: !currentlyFavorited } : old
      );
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast.error('Failed to update favorite');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const handleToggleFavorite = useCallback(() => {
    favoriteMutation.mutate(isFavorited);
  }, [favoriteMutation, isFavorited]);

  return {
    isFavorited,
    handleToggleFavorite,
    isPending: favoriteMutation.isPending,
  };
}
