import { ChevronDown, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { McpServer, ToolDescription } from '@/types';

interface MatrixToolsPanelProps {
  mcpServers: McpServer[];
  allTools: ToolDescription[];
  enabledServerIds: string[];
  setEnabledServerIds: (ids: string[]) => void;
  excludedToolNames: string[];
  setExcludedToolNames: (names: string[]) => void;
}

export function MatrixToolsPanel({
  mcpServers,
  allTools,
  enabledServerIds,
  setEnabledServerIds,
  excludedToolNames,
  setExcludedToolNames,
}: MatrixToolsPanelProps) {
  const activeServers = useMemo(
    () => mcpServers.filter((s) => s.isActive),
    [mcpServers],
  );

  const enabledCount = useMemo(
    () => activeServers.filter((s) => enabledServerIds.includes(s.id)).length,
    [activeServers, enabledServerIds],
  );

  if (activeServers.length === 0) return null;

  const toggleServer = (serverId: string, enabled: boolean) => {
    setEnabledServerIds(
      enabled
        ? [...enabledServerIds, serverId]
        : enabledServerIds.filter((id) => id !== serverId),
    );
  };

  const toggleTool = (toolName: string, included: boolean) => {
    setExcludedToolNames(
      included
        ? excludedToolNames.filter((n) => n !== toolName)
        : [...excludedToolNames, toolName],
    );
  };

  return (
    <div className="border-t border-border-subtle">
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 transition-colors group">
          <div className="flex items-center gap-2">
            <Wrench className="size-4" />
            Tools
            {enabledCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {enabledCount} active
              </Badge>
            )}
          </div>
          <ChevronDown className="size-4 text-foreground-muted transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {activeServers.map((server) => (
              <ServerRow
                key={server.id}
                server={server}
                enabled={enabledServerIds.includes(server.id)}
                onToggle={(enabled) => toggleServer(server.id, enabled)}
                tools={allTools.filter((t) => t.mcpServerName === server.name)}
                excludedToolNames={excludedToolNames}
                onToggleTool={toggleTool}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface ServerRowProps {
  server: McpServer;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  tools: ToolDescription[];
  excludedToolNames: string[];
  onToggleTool: (toolName: string, included: boolean) => void;
}

function ServerRow({
  server,
  enabled,
  onToggle,
  tools,
  excludedToolNames,
  onToggleTool,
}: ServerRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border-subtle">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium hover:text-foreground transition-colors min-w-0"
          onClick={() => tools.length > 0 && setExpanded(!expanded)}
          disabled={tools.length === 0}
        >
          {tools.length > 0 && (
            <ChevronDown
              className={cn(
                'size-3 text-foreground-muted transition-transform shrink-0',
                expanded && 'rotate-180',
              )}
            />
          )}
          <span className="truncate">{server.name}</span>
          {tools.length > 0 && (
            <span className="text-foreground-muted font-normal">({tools.length})</span>
          )}
        </button>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${server.name}`}
          className="scale-75"
        />
      </div>
      {expanded && tools.length > 0 && (
        <div className="border-t border-border-subtle px-3 py-2 space-y-1.5">
          {tools.map((tool) => {
            const isIncluded = !excludedToolNames.includes(tool.toolName);
            return (
              <label
                key={tool.id}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
              >
                <Checkbox
                  checked={isIncluded}
                  onCheckedChange={(checked) =>
                    onToggleTool(tool.toolName, checked === true)
                  }
                  disabled={!enabled}
                  className="size-3.5"
                />
                <span className={cn('truncate', !enabled && 'text-foreground-muted')}>
                  {tool.toolName}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
