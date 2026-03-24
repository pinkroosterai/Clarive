import { Eye, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TabInfo, VersionInfo } from '@/types';

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string | undefined;
  onTabSelect: (tabId: string) => void;
  onCreateTab: () => void;
  onDeleteTab?: (tabId: string) => void;
  onViewPublished?: () => void;
  hasPublished?: boolean;
  isViewingPublished?: boolean;
  isReadOnly?: boolean;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onCreateTab,
  onDeleteTab,
  onViewPublished,
  hasPublished,
  isViewingPublished,
  isReadOnly,
}: TabBarProps) {
  if (tabs.length <= 1 && isReadOnly && !hasPublished) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-border-subtle px-1 min-h-[40px] overflow-x-auto">
      {/* Published version pinned tab */}
      {hasPublished && onViewPublished && (
        <button
          onClick={onViewPublished}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors shrink-0 border-b-2',
            isViewingPublished
              ? 'border-b-green-500 bg-green-500/8 text-green-700 dark:text-green-400 font-medium'
              : 'border-b-transparent text-foreground-muted hover:text-foreground hover:bg-elevated/50'
          )}
        >
          <Eye className="size-3.5" />
          <span>Published</span>
        </button>
      )}

      {hasPublished && tabs.length > 0 && (
        <div className="w-px h-5 bg-border-subtle mx-1 shrink-0" />
      )}

      {/* Tab list */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId && !isViewingPublished;
        return (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors shrink-0 border-b-2',
              isActive
                ? 'border-b-primary bg-primary/8 text-foreground font-medium'
                : 'border-b-transparent text-foreground-muted hover:text-foreground hover:bg-elevated/50'
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

      {/* Create tab button */}
      {!isReadOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 ml-1"
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
