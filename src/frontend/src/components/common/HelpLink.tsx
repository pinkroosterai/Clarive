import { CircleHelp } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getDocsUrl } from '@/lib/docsUrl';

export function HelpLink({ section }: { section: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={getDocsUrl(section)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Help"
        >
          <CircleHelp className="size-3.5" />
        </a>
      </TooltipTrigger>
      <TooltipContent>Learn more</TooltipContent>
    </Tooltip>
  );
}
