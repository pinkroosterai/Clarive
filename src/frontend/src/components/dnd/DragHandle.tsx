import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragHandleProps {
  listeners: SyntheticListenerMap | undefined;
  attributes: Record<string, unknown>;
  className?: string;
}

export function DragHandle({ listeners, attributes, className }: DragHandleProps) {
  return (
    <button
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm opacity-0 group-hover/drag-item:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing transition-opacity duration-150 touch-none",
        className,
      )}
      tabIndex={0}
      aria-label="Drag to move"
      {...listeners}
      {...attributes}
    >
      <GripVertical className="size-3.5 text-foreground-muted" />
    </button>
  );
}
