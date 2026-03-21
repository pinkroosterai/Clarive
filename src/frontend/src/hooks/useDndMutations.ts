import { useMutation, useQueryClient } from '@tanstack/react-query';

import { handleApiError } from '@/lib/handleApiError';
import { entryService, folderService } from '@/services';

export interface MoveEntryParams {
  id: string;
  folderId: string | null;
}

export interface MoveFolderParams {
  id: string;
  newParentId: string | null;
}

export function useDndMutations(options?: {
  onEntryMoved?: (params: MoveEntryParams) => void;
  onFolderMoved?: (params: MoveFolderParams) => void;
}) {
  const queryClient = useQueryClient();

  const moveEntry = useMutation({
    mutationFn: ({ id, folderId }: MoveEntryParams) =>
      entryService.moveEntry(id, folderId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      options?.onEntryMoved?.(variables);
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const moveFolder = useMutation({
    mutationFn: ({ id, newParentId }: MoveFolderParams) =>
      folderService.moveFolder(id, newParentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      options?.onFolderMoved?.(variables);
    },
    onError: (err: unknown) => handleApiError(err),
  });

  return { moveEntry, moveFolder };
}
