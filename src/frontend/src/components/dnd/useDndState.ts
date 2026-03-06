import { createContext, useContext } from 'react';

import type { DragData } from '@/lib/dnd/types';

export interface DndStateContextValue {
  activeItem: DragData | null;
  overId: string | null;
  isValidTarget: (targetFolderId: string | null) => boolean;
}

export const DndStateContext = createContext<DndStateContextValue>({
  activeItem: null,
  overId: null,
  isValidTarget: () => false,
});

export function useDndState() {
  return useContext(DndStateContext);
}
