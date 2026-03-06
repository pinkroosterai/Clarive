import { memo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Copy,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { Prompt } from "@/types";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { copyToClipboard } from "@/lib/utils";

const SYNTAX_ROWS = [
  { type: "string", example: "{{topic}}", description: "Text input (default)" },
  { type: "int", example: "{{count|int:1-100}}", description: "Integer with range" },
  { type: "float", example: "{{temp|float:0-2}}", description: "Decimal with range" },
  { type: "enum", example: "{{tone|enum:formal,casual}}", description: "Dropdown select" },
] as const;

function TemplateSyntaxHelp() {
  return (
    <div className="rounded-lg bg-surface border border-border p-3 text-xs">
      <p className="mb-2 font-medium text-foreground">Template tag syntax</p>
      <code className="mb-2 block text-foreground-muted">
        {"{{name}}  {{name|type}}  {{name|type:options}}"}
      </code>
      <table className="w-full text-left">
        <thead>
          <tr className="text-foreground-muted">
            <th className="pb-1 pr-3 font-medium">Type</th>
            <th className="pb-1 pr-3 font-medium">Example</th>
            <th className="pb-1 font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          {SYNTAX_ROWS.map((row) => (
            <tr key={row.type}>
              <td className="pr-3 py-0.5">
                <code className="rounded bg-elevated px-1">{row.type}</code>
              </td>
              <td className="pr-3 py-0.5">
                <code className="text-primary">{row.example}</code>
              </td>
              <td className="py-0.5 text-foreground-muted">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-foreground-muted">
        Names allow letters, digits, and underscores. First occurrence of each name wins.
      </p>
    </div>
  );
}

interface PromptCardProps {
  prompt: Prompt;
  index: number;
  isOnly: boolean;
  isLast: boolean;
  isReadOnly: boolean;
  onUpdate: (updated: Prompt) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const PromptCard = memo(function PromptCard({
  prompt,
  index,
  isOnly,
  isLast,
  isReadOnly,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PromptCardProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(prompt.content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const borderColor = index === 1 ? "border-l-blue-500" : index === 2 ? "border-l-cyan-500" : "border-l-emerald-500";

  return (
    <Card className={`border-l-2 ${borderColor}`}>
      <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <span className="text-sm font-medium text-foreground">
            Prompt #{index}
          </span>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-foreground-muted"
                  aria-label="Toggle template syntax help"
                >
                  <HelpCircle className="size-3.5" />
                  Syntax help
                </Button>
              </CollapsibleTrigger>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
                  <Copy className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to clipboard</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <TemplateSyntaxHelp />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <CardContent className="space-y-2">
        <MarkdownEditor
          key={prompt.id}
          content={prompt.content}
          onContentChange={(md) => onUpdate({ ...prompt, content: md })}
          editable={!isReadOnly}
          placeholder="Enter your prompt…"
          templateHighlight={true}
          minHeightClass="min-h-[120px]"
        />
      </CardContent>

      {!isOnly && !isReadOnly && (
        <CardFooter className="justify-between pt-0">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={index === 1}
              onClick={onMoveUp}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={isLast}
              onClick={onMoveDown}
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive gap-1.5"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        </CardFooter>
      )}
    </Card>
  );
});
