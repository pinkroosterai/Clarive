import { useState, useEffect } from "react";
import { ChevronDown, MessageSquare, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

interface SystemMessageSectionProps {
  systemMessage: string | null;
  onChange: (value: string | null) => void;
  isReadOnly: boolean;
}

export function SystemMessageSection({
  systemMessage,
  onChange,
  isReadOnly,
}: SystemMessageSectionProps) {
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  // Reset auto-focus flag after the editor mounts with it
  useEffect(() => {
    if (shouldAutoFocus) setShouldAutoFocus(false);
  }, [shouldAutoFocus]);

  if (systemMessage === null) {
    if (isReadOnly) return null;
    return (
      <div data-tour="system-message">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            setShouldAutoFocus(true);
            onChange("");
          }}
        >
          <Plus className="size-4" />
          Add system message
        </Button>
      </div>
    );
  }

  return (
    <Collapsible defaultOpen data-tour="system-message">
      <div className="flex items-center gap-2 border-l-2 border-primary pl-3">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
          <ChevronDown className="chevron size-4 text-foreground-muted transition-transform duration-200" />
          <MessageSquare className="size-4 text-foreground-muted" />
          System Message
        </CollapsibleTrigger>
        {!isReadOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onChange(null)}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <CollapsibleContent className="mt-2">
        <MarkdownEditor
          content={systemMessage}
          onContentChange={(md) => onChange(md)}
          editable={!isReadOnly}
          placeholder="Enter a system message to set the AI's behavior…"
          minHeightClass="min-h-[80px]"
          autoFocus={shouldAutoFocus}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
