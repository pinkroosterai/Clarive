import { CircleHelp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function HelpLink({ section }: { section: string }) {
  const navigate = useNavigate();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => navigate(`/help#${section}`)}
          className="inline-flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Help"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Learn more</TooltipContent>
    </Tooltip>
  );
}
