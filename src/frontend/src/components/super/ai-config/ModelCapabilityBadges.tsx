import { Braces, Brain, SquareFunction } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ModelCapabilityBadgesProps {
  isReasoning: boolean;
  supportsFunctionCalling: boolean;
  supportsResponseSchema: boolean;
}

export default function ModelCapabilityBadges({
  isReasoning,
  supportsFunctionCalling,
  supportsResponseSchema,
}: ModelCapabilityBadgesProps) {
  return (
    <div className="flex items-center gap-0.5 text-foreground-muted">
      <Tooltip>
        <TooltipTrigger asChild>
          <Brain className={cn('size-3.5', isReasoning ? 'opacity-100' : 'opacity-20')} />
        </TooltipTrigger>
        <TooltipContent side="top"><p>Reasoning model</p></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <SquareFunction className={cn('size-3.5', supportsFunctionCalling ? 'opacity-100' : 'opacity-20')} />
        </TooltipTrigger>
        <TooltipContent side="top"><p>Function calling</p></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Braces className={cn('size-3.5', supportsResponseSchema ? 'opacity-100' : 'opacity-20')} />
        </TooltipTrigger>
        <TooltipContent side="top"><p>Structured responses</p></TooltipContent>
      </Tooltip>
    </div>
  );
}
