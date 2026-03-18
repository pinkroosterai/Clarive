import { Braces, Brain, SquareFunction } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null) return '—';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return tokens.toString();
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null) return '—';
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

interface ModelCapabilityBadgesProps {
  isReasoning: boolean;
  supportsFunctionCalling: boolean;
  supportsResponseSchema: boolean;
  maxInputTokens?: number | null;
  maxOutputTokens?: number | null;
  inputCostPerMillion?: number | null;
  outputCostPerMillion?: number | null;
  compact?: boolean;
}

export default function ModelCapabilityBadges({
  isReasoning,
  supportsFunctionCalling,
  supportsResponseSchema,
  maxInputTokens,
  maxOutputTokens,
  inputCostPerMillion,
  outputCostPerMillion,
  compact,
}: ModelCapabilityBadgesProps) {
  return (
    <div className="flex items-center gap-1.5 text-foreground-muted">
      {/* Capability icons */}
      <div className="flex items-center gap-0.5">
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

      {/* Metadata (non-compact only) */}
      {!compact && (
        <>
          <span className="text-[10px] tabular-nums">
            {formatTokens(maxInputTokens)}/{formatTokens(maxOutputTokens)}
          </span>
          <span className="text-[10px] tabular-nums">
            {formatCost(inputCostPerMillion)}/{formatCost(outputCostPerMillion)}
          </span>
        </>
      )}
    </div>
  );
}
