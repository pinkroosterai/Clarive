import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Download, CheckCircle2, ChevronDown, ChevronRight, Key } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { handleApiError } from '@/lib/handleApiError';
import { toolService } from '@/services';
import type { ToolDescription } from '@/types';

type State = 'idle' | 'loading' | 'results';

export function McpImportSection() {
  const [url, setUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [imported, setImported] = useState<ToolDescription[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const queryClient = useQueryClient();

  const handleImport = async () => {
    if (!url.trim()) return;
    setState('loading');
    try {
      const result = await toolService.importFromMcp(url.trim(), bearerToken.trim() || undefined);
      setImported(result.imported);
      setSkippedCount(result.skippedCount);
      setState('results');
    } catch (err) {
      handleApiError(err, {
        title: 'Import failed',
        fallback: 'Could not connect to the MCP server.',
      });
      setState('idle');
    }
  };

  const handleDone = () => {
    setImported([]);
    setSkippedCount(0);
    setUrl('');
    setBearerToken('');
    setShowAuth(false);
    setState('idle');
    queryClient.invalidateQueries({ queryKey: ['tools'] });
  };

  return (
    <Card className="mt-8 bg-surface border-2 border-dashed border-border rounded-xl hover:border-primary/30 transition-colors">
      <CardHeader>
        <CardTitle className="text-base">Import from MCP Server</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === 'idle' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://mcp-server.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="max-w-md bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
              <Button onClick={handleImport} disabled={!url.trim()}>
                <Download className="size-4 mr-1" /> Import
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setShowAuth(!showAuth)}
              className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              {showAuth ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <Key className="size-3" />
              Authentication
            </button>
            {showAuth && (
              <Input
                type="password"
                placeholder="Bearer token (optional)"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                className="max-w-md bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            )}
          </div>
        )}

        {state === 'loading' && (
          <div className="flex items-center gap-3 text-foreground-muted">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Connecting to MCP server and discovering tools…</span>
          </div>
        )}

        {state === 'results' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 text-success-text" />
              {imported.length} tool{imported.length !== 1 ? 's' : ''} imported
              {skippedCount > 0 && (
                <span className="text-foreground-muted font-normal">
                  , {skippedCount} skipped (already exist)
                </span>
              )}
            </div>
            {imported.length > 0 && (
              <div className="bg-success-bg border border-success-border rounded-xl divide-y divide-success-border overflow-hidden">
                {imported.map((t) => (
                  <div key={t.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      <span className="font-mono text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md">
                        {t.toolName}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted">{t.description}</p>
                    <ParamSummary schema={t.inputSchema} />
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleDone}>Done</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParamSummary({ schema }: { schema?: Record<string, unknown> }) {
  if (!schema) return null;
  const properties = schema.properties as Record<string, { type?: string }> | undefined;
  if (!properties) return null;

  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);

  const params = Object.entries(properties).map(([name, def]) => {
    const type = def?.type ?? 'any';
    const req = required.has(name) ? ', required' : '';
    return `${name} (${type}${req})`;
  });

  if (params.length === 0) return null;

  return <p className="text-xs text-foreground-muted/70">Parameters: {params.join(', ')}</p>;
}
