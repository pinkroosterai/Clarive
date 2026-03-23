import { Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface HelpPopoverProps {
  content: string;
  section?: string;
}

export function HelpPopover({ content, section }: HelpPopoverProps) {
  const navigate = useNavigate();

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
          <button
            type="button"
            onClick={() => navigate(`/help#${section}`)}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Learn more
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
