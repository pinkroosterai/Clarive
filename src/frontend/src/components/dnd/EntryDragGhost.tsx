import { FileText } from 'lucide-react';

interface EntryDragGhostProps {
  title: string;
}

export function EntryDragGhost({ title }: EntryDragGhostProps) {
  return (
    <div className="flex items-center gap-2 w-52 rounded-lg bg-card border border-primary/30 px-3 py-2 elevation-4 glow-brand-sm">
      <FileText className="size-4 shrink-0 text-primary" />
      <span className="truncate text-sm font-medium">{title}</span>
    </div>
  );
}
