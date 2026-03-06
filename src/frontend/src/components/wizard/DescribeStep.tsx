import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Mail } from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { toolService } from "@/services";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface GenerateOptions {
  generateSystemMessage: boolean;
  generateAsTemplate: boolean;
  generateAsChain: boolean;
  selectedToolIds: string[];
}

interface DescribeStepProps {
  onGenerate: (description: string, options: GenerateOptions) => void;
  isGenerating: boolean;
}

export function DescribeStep({ onGenerate, isGenerating }: DescribeStepProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isVerified = currentUser?.emailVerified ?? false;
  const [description, setDescription] = useState("");
  const [generateSystemMessage, setGenerateSystemMessage] = useState(false);
  const [generateAsTemplate, setGenerateAsTemplate] = useState(false);
  const [generateAsChain, setGenerateAsChain] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);

  const { data: tools = [] } = useQuery({
    queryKey: ["tools"],
    queryFn: toolService.getToolsList,
  });

  const toggleTool = (id: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    onGenerate(description.trim(), {
      generateSystemMessage,
      generateAsTemplate,
      generateAsChain,
      selectedToolIds,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="wizard-desc">Describe the prompt you want to create</Label>
        <Textarea
          id="wizard-desc"
          rows={6}
          placeholder="e.g. A prompt that helps users write professional emails given a topic and tone..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isGenerating}
          className="bg-elevated border-border focus:ring-2 focus:ring-primary/30 min-h-[160px] transition-shadow"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
        <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
          <Label htmlFor="sw-sys">Generate system message</Label>
          <Switch id="sw-sys" checked={generateSystemMessage} onCheckedChange={setGenerateSystemMessage} disabled={isGenerating} />
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
          <Label htmlFor="sw-tpl">Generate as prompt template</Label>
          <Switch id="sw-tpl" checked={generateAsTemplate} onCheckedChange={setGenerateAsTemplate} disabled={isGenerating} />
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
          <Label htmlFor="sw-chain">Generate as prompt chain</Label>
          <Switch id="sw-chain" checked={generateAsChain} onCheckedChange={setGenerateAsChain} disabled={isGenerating} />
        </div>
      </div>

      {tools.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Available Tools</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {tools.map((tool) => (
              <label
                key={tool.id}
                className={`flex items-center gap-3 cursor-pointer bg-surface border rounded-lg px-3 py-2 transition-colors ${
                  selectedToolIds.includes(tool.id)
                    ? "border-primary/50 bg-primary/8"
                    : "border-border-subtle hover:border-primary/30"
                }`}
              >
                <Checkbox
                  checked={selectedToolIds.includes(tool.id)}
                  onCheckedChange={() => toggleTool(tool.id)}
                  disabled={isGenerating}
                />
                <div className="min-w-0">
                  <span className="text-sm block truncate">{tool.name}</span>
                  <code className="text-xs font-mono text-foreground-muted bg-elevated px-1.5 py-0.5 rounded">
                    {tool.toolName}
                  </code>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {tools.length === 0 && (
        <p className="text-sm text-foreground-muted">No tools configured. You can add tools from the Tools page.</p>
      )}

      <div className="space-y-2">
        <Button
          className="w-full gap-2 py-3 text-base"
          onClick={handleGenerate}
          disabled={!description.trim() || isGenerating || !isVerified}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate
            </>
          )}
        </Button>
        {!isVerified ? (
          <p className="text-xs text-center text-warning-text flex items-center justify-center gap-1">
            <Mail className="size-3" />
            Verify your email to use AI features
          </p>
        ) : null}
      </div>
    </div>
  );
}
