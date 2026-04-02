import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Braces,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SquareFunction,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import ModelCapabilityBadges from '../ai-config/ModelCapabilityBadges';

import { type ModelFilters, useModelBrowser } from './useModelBrowser';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { FetchedModelItem } from '@/services/api/aiProviderService';

interface ModelBrowserProps {
  models: FetchedModelItem[];
  onAddModel: (modelId: string) => void;
  isFetchingModels: boolean;
  onFetchModels: () => void;
  fetchedModels: FetchedModelItem[] | null;
}

type FlatItem =
  | { type: 'header'; provider: string; count: number }
  | { type: 'model'; model: FetchedModelItem };

function formatTokens(n: number | null): string {
  if (n == null) return '\u2014';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatCostPerMillion(n: number | null): string {
  if (n == null) return '\u2014';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

export default function ModelBrowser({
  models,
  onAddModel,
  isFetchingModels,
  onFetchModels,
  fetchedModels,
}: ModelBrowserProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ModelFilters>({
    reasoning: false,
    functionCalling: false,
    responseSchema: false,
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { groups, totalCount, filteredCount } = useModelBrowser(models, search, filters);

  const toggleFilter = useCallback((key: keyof ModelFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleGroup = useCallback((provider: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  }, []);

  // Flatten groups into a single array for virtual scrolling
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const group of groups) {
      items.push({ type: 'header', provider: group.provider, count: group.models.length });
      if (!collapsedGroups.has(group.provider)) {
        for (const model of group.models) {
          items.push({ type: 'model', model });
        }
      }
    }
    return items;
  }, [groups, collapsedGroups]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (flatItems[index].type === 'header' ? 30 : 38),
    overscan: 10,
  });

  const hasActiveFilters = filters.reasoning || filters.functionCalling || filters.responseSchema;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="max-w-sm w-full justify-between text-xs"
            size="sm"
            disabled={!fetchedModels}
          >
            {isFetchingModels ? (
              <span className="flex items-center gap-2 text-foreground-muted">
                <Loader2 className="size-3.5 animate-spin" />
                Loading models...
              </span>
            ) : !fetchedModels ? (
              <span className="text-foreground-muted">Fetch models first</span>
            ) : totalCount === 0 ? (
              <span className="text-foreground-muted">All models added</span>
            ) : (
              <span className="text-foreground-muted">
                Select model to add ({totalCount} available)
              </span>
            )}
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[540px] p-0" align="start">
          <div className="flex flex-col">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
              <Search className="size-3.5 text-foreground-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-foreground-muted"
                placeholder="Search models..."
                autoFocus
              />
              {hasActiveFilters || search ? (
                <span className="text-[10px] text-foreground-muted">
                  {filteredCount} of {totalCount}
                </span>
              ) : null}
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-subtle">
              <FilterChip
                active={filters.reasoning}
                onClick={() => toggleFilter('reasoning')}
                icon={<Brain className="size-3" />}
                label="Reasoning"
              />
              <FilterChip
                active={filters.functionCalling}
                onClick={() => toggleFilter('functionCalling')}
                icon={<SquareFunction className="size-3" />}
                label="Function Calling"
              />
              <FilterChip
                active={filters.responseSchema}
                onClick={() => toggleFilter('responseSchema')}
                icon={<Braces className="size-3" />}
                label="Response Schema"
              />
            </div>

            {/* Virtualized list */}
            <div ref={parentRef} className="max-h-[350px] overflow-y-auto">
              {flatItems.length === 0 ? (
                <p className="text-xs text-foreground-muted text-center py-6">
                  No matching models.
                </p>
              ) : (
                <div
                  style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = flatItems[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {item.type === 'header' ? (
                          <button
                            onClick={() => toggleGroup(item.provider)}
                            className="flex items-center gap-1.5 px-3 w-full h-full text-xs font-medium text-foreground-muted hover:text-foreground bg-elevated/50"
                          >
                            {collapsedGroups.has(item.provider) ? (
                              <ChevronRight className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                            {item.provider}
                            <span className="text-[10px] opacity-60">{item.count}</span>
                          </button>
                        ) : (
                          <ModelRow model={item.model} onAdd={onAddModel} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="sm"
        onClick={onFetchModels}
        disabled={isFetchingModels}
        title="Fetch available models from provider"
      >
        {isFetchingModels ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Badge
      variant={active ? 'secondary' : 'outline'}
      className="cursor-pointer select-none gap-1 text-[10px] px-1.5 py-0.5"
      onClick={onClick}
    >
      {icon}
      {label}
    </Badge>
  );
}

function ModelRow({ model, onAdd }: { model: FetchedModelItem; onAdd: (id: string) => void }) {
  // Strip provider prefix for display
  const displayName = model.modelId.includes('/')
    ? model.modelId.substring(model.modelId.indexOf('/') + 1)
    : model.modelId;

  return (
    <button
      onClick={() => onAdd(model.modelId)}
      className="flex items-center gap-2 px-3 w-full h-full text-xs hover:bg-elevated/50 group"
    >
      <Plus className="size-3 text-foreground-muted opacity-0 group-hover:opacity-100 shrink-0" />
      <span className="font-mono flex-1 text-left truncate" title={model.modelId}>
        {displayName}
      </span>
      <ModelCapabilityBadges
        isReasoning={model.isReasoning}
        supportsFunctionCalling={model.supportsFunctionCalling}
        supportsResponseSchema={model.supportsResponseSchema}
      />
      <span
        className="text-[10px] text-foreground-muted w-10 text-right shrink-0"
        title="Max input tokens"
      >
        {formatTokens(model.maxInputTokens)}
      </span>
      <span
        className="text-[10px] text-foreground-muted w-24 text-right shrink-0"
        title="Cost per 1M tokens (input / output)"
      >
        {formatCostPerMillion(model.inputCostPerMillion)} /{' '}
        {formatCostPerMillion(model.outputCostPerMillion)}
      </span>
    </button>
  );
}
