import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { groupByProvider, type ProviderModel } from './aiConfigUtils';
import ModelCapabilityBadges from './ModelCapabilityBadges';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProviderModelComboboxProps {
  providerModels: ProviderModel[];
  value: string;
  providerId: string;
  providerName?: string;
  onSelect: (model: ProviderModel) => void;
  onClear: () => void;
  loading?: boolean;
  placeholder?: string;
}

export default function ProviderModelCombobox({
  providerModels,
  value,
  providerId,
  providerName,
  onSelect,
  onClear,
  loading,
  placeholder,
}: ProviderModelComboboxProps) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => groupByProvider(providerModels), [providerModels]);

  return (
    <div className="flex items-center gap-1.5 max-w-md w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-foreground-muted">
                <Loader2 className="size-4 animate-spin" />
                Loading models...
              </span>
            ) : value ? (
              <span className="flex items-center gap-1.5 truncate">
                <span>{value}</span>
                {providerName && (
                  <span className="text-foreground-muted text-xs">via {providerName}</span>
                )}
              </span>
            ) : (
              <span className="text-foreground-muted">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-md w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search models..." />
            <CommandList>
              <CommandEmpty>No models found.</CommandEmpty>
              {Object.entries(grouped).map(([groupName, models]) => (
                <CommandGroup key={groupName} heading={groupName}>
                  {models.map((m) => {
                    const isSelected = m.modelId === value && m.providerId === providerId;
                    return (
                      <CommandItem
                        key={`${m.providerId}:${m.modelId}`}
                        value={`${m.providerName} ${m.modelId}`}
                        onSelect={() => {
                          onSelect(m);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                        />
                        <span className="flex-1">{m.modelId}</span>
                        <ModelCapabilityBadges
                          isReasoning={m.isReasoning}
                          supportsFunctionCalling={m.supportsFunctionCalling}
                          supportsResponseSchema={m.supportsResponseSchema}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClear} className="shrink-0">
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear selection</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
