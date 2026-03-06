import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';

import { useDndState } from './useDndState';

import { DROPPABLE_ROOT_ID, droppableFolderId } from '@/lib/dnd/types';
import { cn } from '@/lib/utils';

interface DroppableFolderWrapperProps {
  folderId: string | null;
  children: ReactNode;
  className?: string;
}

export function DroppableFolderWrapper({
  folderId,
  children,
  className,
}: DroppableFolderWrapperProps) {
  const droppableId = folderId === null ? DROPPABLE_ROOT_ID : droppableFolderId(folderId);
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const { activeItem, isValidTarget } = useDndState();

  const showHighlight = isOver && activeItem !== null && isValidTarget(folderId);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md transition-all duration-150',
        showHighlight && 'ring-1 ring-primary/50 bg-primary/5 glow-brand-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
