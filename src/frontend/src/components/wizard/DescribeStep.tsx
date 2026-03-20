import { useQuery } from '@tanstack/react-query';
import { Globe, Loader2, Sparkles, Mail, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toolService, wizardService } from '@/services';
import { useAuthStore } from '@/store/authStore';

export interface GenerateOptions {
  generateSystemMessage: boolean;
  generateAsTemplate: boolean;
  generateAsChain: boolean;
  selectedToolIds: string[];
  enableWebSearch: boolean;
}

interface DescribeStepProps {
  onGenerate: (description: string, options: GenerateOptions) => void;
  isGenerating: boolean;
}

export function DescribeStep({ onGenerate, isGenerating }: DescribeStepProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const webSearchAvailable = useAuthStore((s) => s.webSearchAvailable);
  const isVerified = currentUser?.emailVerified ?? false;
  const [description, setDescription] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [generateSystemMessage, setGenerateSystemMessage] = useState(false);
  const [generateAsTemplate, setGenerateAsTemplate] = useState(false);
  const [generateAsChain, setGenerateAsChain] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isPolished, setIsPolished] = useState(false);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, []);

  // Auto-resize when description changes programmatically (e.g., after polish)
  useEffect(() => {
    resizeTextarea();
  }, [description, resizeTextarea]);

  const handlePolish = async () => {
    if (!description.trim() || isPolishing || isPolished) return;
    setIsPolishing(true);
    try {
      const polished = await wizardService.polishDescription(description.trim());
      setDescription(polished);
      setIsPolished(true);
    } catch {
      toast.error('Failed to polish description. Please try again.');
    } finally {
      setIsPolishing(false);
    }
  };

  const { data: tools = [] } = useQuery({
    queryKey: ['tools'],
    queryFn: toolService.getToolsList,
  });

  const toggleTool = (id: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setIsPolished(false);
  };

  const handleGenerate = () => {
    onGenerate(description.trim(), {
      generateSystemMessage,
      generateAsTemplate,
      generateAsChain,
      selectedToolIds,
      enableWebSearch,
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent/30 to-primary/5 px-6 py-8">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 size-36 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              What would you like to create?
            </h2>
          </div>
          <p className="text-sm text-foreground-muted max-w-md">
            Describe your idea and the AI will generate a structured, high-quality prompt for you.
          </p>
        </div>
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          id="wizard-desc"
          placeholder="e.g. A prompt that helps users write professional emails given a topic and tone..."
          value={description}
          onChange={handleTextareaChange}
          disabled={isGenerating || isPolishing}
          style={{ minHeight: '160px' }}
          className="bg-elevated border-border focus:ring-2 focus:ring-primary/30 resize-none overflow-hidden transition-shadow pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 size-8 text-foreground-muted hover:text-primary"
          onClick={handlePolish}
          disabled={!description.trim() || isGenerating || isPolishing || isPolished}
          title={isPolished ? 'Description already polished' : 'Polish description with AI'}
          aria-label="Polish description with AI"
        >
          {isPolishing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
        <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
          <div>
            <Label htmlFor="sw-sys">Generate system message</Label>
            <p className="text-xs text-foreground-muted mt-0.5">
              Sets the AI's role and behavior before the main prompt
            </p>
          </div>
          <Switch
            id="sw-sys"
            checked={generateSystemMessage}
            onCheckedChange={setGenerateSystemMessage}
            disabled={isGenerating}
          />
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
          <div>
            <Label htmlFor="sw-tpl">Generate as prompt template</Label>
            <p className="text-xs text-foreground-muted mt-0.5">
              {'Includes {{variable}} placeholders for dynamic content'}
            </p>
          </div>
          <Switch
            id="sw-tpl"
            checked={generateAsTemplate}
            onCheckedChange={setGenerateAsTemplate}
            disabled={isGenerating}
          />
        </div>
        <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
          <div>
            <Label htmlFor="sw-chain">Generate as prompt chain</Label>
            <p className="text-xs text-foreground-muted mt-0.5">
              Splits into multiple sequential prompts for complex tasks
            </p>
          </div>
          <Switch
            id="sw-chain"
            checked={generateAsChain}
            onCheckedChange={setGenerateAsChain}
            disabled={isGenerating}
          />
        </div>
        {webSearchAvailable && (
          <div className="bg-elevated rounded-lg px-4 py-3 flex justify-between items-center hover:bg-overlay/50 transition-colors">
            <div>
              <Label htmlFor="sw-web" className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                Enable web research
              </Label>
              <p className="text-xs text-foreground-muted mt-0.5">
                Searches the web for context to improve accuracy
              </p>
            </div>
            <Switch
              id="sw-web"
              checked={enableWebSearch}
              onCheckedChange={setEnableWebSearch}
              disabled={isGenerating}
            />
          </div>
        )}
      </div>

      {tools.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Available Tools</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {tools.map((tool) => (
              <label
                key={tool.id}
                htmlFor={`tool-${tool.id}`}
                className={`flex items-center gap-3 cursor-pointer bg-surface border rounded-lg px-3 py-2 transition-colors ${
                  selectedToolIds.includes(tool.id)
                    ? 'border-primary/50 bg-primary/8'
                    : 'border-border-subtle hover:border-primary/30'
                }`}
              >
                <Checkbox
                  id={`tool-${tool.id}`}
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
        <p className="text-sm text-foreground-muted">
          No tools configured. You can add tools from the Tools page.
        </p>
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
