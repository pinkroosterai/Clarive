import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TabInfo } from '@/types';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | undefined;
  onTabSelect: (tabId: string) => void;
  onCreateTab: () => void;
  onDeleteTab?: (tabId: string) => void;
  isReadOnly?: boolean;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onCreateTab,
  onDeleteTab,
  isReadOnly,
}: TabBarProps) {
  if (tabs.length <= 1 && isReadOnly) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-border-subtle px-1 pb-0 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-md transition-colors shrink-0',
              isActive
                ? 'bg-background border border-b-0 border-border-subtle text-foreground font-medium -mb-px'
                : 'text-foreground-muted hover:text-foreground hover:bg-elevated/50'
            )}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            {!tab.isMainTab && !isReadOnly && onDeleteTab && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 p-0.5 rounded hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTab(tab.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        onDeleteTab(tab.id);
                      }
                    }}
                  >
                    <X className="size-3 text-foreground-muted hover:text-destructive" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Delete tab</TooltipContent>
              </Tooltip>
            )}
          </button>
        );
      })}
      {!isReadOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 ml-1"
              onClick={onCreateTab}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create new tab</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
