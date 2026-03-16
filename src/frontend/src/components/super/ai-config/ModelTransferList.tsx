import { ChevronRight, Loader2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ModelTransferListProps {
  allModels: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export default function ModelTransferList({
  allModels,
  value,
  onChange,
  loading,
}: ModelTransferListProps) {
  const [search, setSearch] = useState('');

  const allowedSet = useMemo(() => {
    if (!value) return new Set<string>();
    return new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }, [value]);

  const available = useMemo(() => {
    const filtered = allModels.filter((m) => !allowedSet.has(m));
    if (!search) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((m) => m.toLowerCase().includes(q));
  }, [allModels, allowedSet, search]);

  const allowed = useMemo(() => {
    return value
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }, [value]);

  const addModel = (model: string) => {
    const next = [...allowed, model];
    onChange(next.join(','));
  };

  const removeModel = (model: string) => {
    const next = allowed.filter((m) => m !== model);
    onChange(next.join(','));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground-muted py-4">
        <Loader2 className="size-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  if (allModels.length === 0) {
    return (
      <p className="text-sm text-foreground-muted py-2">
        Add an AI provider with models to configure allowed playground models.
      </p>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Available models (left) */}
      <div className="flex-1 space-y-2">
        <Label className="text-xs text-foreground-muted">Available Models</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-foreground-muted" />
          <Input
            placeholder="Filter models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <ScrollArea className="h-48 border border-border-subtle rounded-md">
          <div className="p-1">
            {available.length === 0 ? (
              <p className="text-xs text-foreground-muted p-2 text-center">
                {search ? 'No matching models' : 'All models selected'}
              </p>
            ) : (
              available.map((model) => (
                <button
                  key={model}
                  onClick={() => addModel(model)}
                  className="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-elevated transition-colors group"
                >
                  <span className="font-mono truncate">{model}</span>
                  <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 text-foreground-muted shrink-0" />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Allowed models (right) */}
      <div className="flex-1 space-y-2">
        <Label className="text-xs text-foreground-muted">Allowed Models ({allowed.length})</Label>
        <ScrollArea className="h-[calc(2rem+12rem+2px)] border border-border-subtle rounded-md">
          <div className="p-1">
            {allowed.length === 0 ? (
              <p className="text-xs text-foreground-muted p-2 text-center">All models allowed</p>
            ) : (
              allowed.map((model) => (
                <div
                  key={model}
                  className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-elevated transition-colors group"
                >
                  <span className="font-mono truncate">{model}</span>
                  <button
                    onClick={() => removeModel(model)}
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
