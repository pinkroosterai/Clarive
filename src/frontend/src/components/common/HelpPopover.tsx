import { Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HelpPopoverProps {
  content: string;
  section?: string;
}

export function HelpPopover({ content, section }: HelpPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
          aria-label="More info"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" side="top" align="start">
        <p className="text-xs text-foreground-muted leading-relaxed">{content}</p>
        {section && (
          <a href={`/help#${section}`} className="mt-2 block text-xs text-primary hover:underline">
            Learn more
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
