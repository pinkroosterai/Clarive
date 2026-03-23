import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import * as favoriteService from '@/services/api/favoriteService';

export function useFavoriteMutation(entryId: string | undefined, isFavorited: boolean) {
  const queryClient = useQueryClient();

  const favoriteMutation = useMutation({
    mutationFn: (currentlyFavorited: boolean) =>
      currentlyFavorited
        ? favoriteService.unfavoriteEntry(entryId!)
        : favoriteService.favoriteEntry(entryId!),
    onMutate: async (currentlyFavorited) => {
      await queryClient.cancelQueries({ queryKey: ['entry', entryId] });
      const previous = queryClient.getQueryData(['entry', entryId]);
      queryClient.setQueryData(['entry', entryId], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, isFavorited: !currentlyFavorited } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['entry', entryId], context.previous);
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
