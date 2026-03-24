import { GitCompareArrows, Play, Sparkles, Wand2, Workflow } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AiActionsProps {
  aiEnabled: boolean;
  onEnhance: () => void;
  onGenerateSystemMessage: () => void;
  onDecomposeToChain: () => void;
  isGeneratingSystemMessage: boolean;
  isDecomposing: boolean;
  showGenerateSystemMessage: boolean;
  showDecomposeToChain: boolean;
  onTest?: () => void;
  onCompareVersions?: () => void;
}

export function AiActions({
  aiEnabled,
  onEnhance,
  onGenerateSystemMessage,
  onDecomposeToChain,
  isGeneratingSystemMessage,
  isDecomposing,
  showGenerateSystemMessage,
  showDecomposeToChain,
  onTest,
  onCompareVersions,
}: AiActionsProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button
              variant="outline"
              className="w-full gap-2 hover:border-primary/30 transition-all"
              onClick={onEnhance}
              disabled={!aiEnabled}
            >
              <Sparkles className="size-4" />
              AI Enhance
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          {aiEnabled ? 'Improve your prompt with AI suggestions' : 'AI features are not configured'}
        </TooltipContent>
      </Tooltip>

      {showGenerateSystemMessage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={onGenerateSystemMessage}
                disabled={isGeneratingSystemMessage || !aiEnabled}
              >
                <Wand2 className="size-4" />
                {isGeneratingSystemMessage ? 'Generating\u2026' : 'Generate System Message'}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            {aiEnabled
              ? 'Auto-generate a system message from your prompt'
              : 'AI features are not configured'}
          </TooltipContent>
        </Tooltip>
      )}

      {showDecomposeToChain && (
        <AlertDialog>
          <Tooltip>
            <AlertDialogTrigger asChild>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:border-primary/30 transition-all"
                  disabled={isDecomposing || !aiEnabled}
                >
                  <Workflow className="size-4" />
                  {isDecomposing ? 'Decomposing\u2026' : 'Decompose to Chain'}
                </Button>
              </TooltipTrigger>
            </AlertDialogTrigger>
            <TooltipContent side="left">
              {aiEnabled
                ? 'Split your prompt into a multi-step chain'
                : 'AI features are not configured'}
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Decompose to chain?</AlertDialogTitle>
              <AlertDialogDescription>
                This will split your prompt into a multi-step chain. The original prompt will be
                preserved as the first step.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDecomposeToChain}>Decompose</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {onTest && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={onTest}
                disabled={!aiEnabled}
              >
                <Play className="size-4" />
                Run Prompt
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            {aiEnabled ? 'Run this prompt in the playground' : 'AI features are not configured'}
          </TooltipContent>
        </Tooltip>
      )}

      {onCompareVersions && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={onCompareVersions}
                disabled={!aiEnabled}
              >
                <GitCompareArrows className="size-4" />
                Compare Versions
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            {aiEnabled
              ? 'A/B test two versions against a test dataset'
              : 'AI features are not configured'}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
