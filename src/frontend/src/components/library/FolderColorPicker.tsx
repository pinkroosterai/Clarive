import { Ban } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOLDER_COLORS } from '@/lib/folderColors';
import { cn } from '@/lib/utils';

export function FolderColorPicker({
  currentColor,
  onSelect,
}: {
  currentColor: string | null;
  onSelect: (color: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 p-1.5">
      {/* None / clear option */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onSelect(null)}
            className={cn(
              'flex size-5 items-center justify-center rounded-full border border-border transition-transform hover:scale-110',
              currentColor === null && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
            )}
          >
            <Ban className="size-3 text-foreground-muted" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">None</TooltipContent>
      </Tooltip>

      {/* Color swatches */}
      {FOLDER_COLORS.map((c) => (
        <Tooltip key={c.key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSelect(c.key)}
              className={cn(
                'size-5 rounded-full transition-transform hover:scale-110',
                c.tw,
                currentColor === c.key && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">{c.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
