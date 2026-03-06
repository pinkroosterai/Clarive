import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleApiError } from "@/lib/handleApiError";
import { entryService, folderService } from "@/services";

export function useDndMutations() {
  const queryClient = useQueryClient();

  const moveEntry = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      entryService.moveEntry(id, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Entry moved");
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const moveFolder = useMutation({
    mutationFn: ({ id, newParentId }: { id: string; newParentId: string | null }) =>
      folderService.moveFolder(id, newParentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder moved");
    },
    onError: (err: unknown) => handleApiError(err),
  });

  return { moveEntry, moveFolder };
}
