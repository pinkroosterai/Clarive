import { useQuery } from '@tanstack/react-query';
import { Tag, X } from 'lucide-react';
import { memo, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import * as tagService from '@/services/api/tagService';

interface TagFilterProps {
  selectedTags: string[];
  tagMode: 'and' | 'or';
  onTagsChange: (tags: string[]) => void;
  onTagModeChange: (mode: 'and' | 'or') => void;
}

export const TagFilter = memo(function TagFilter({
  selectedTags,
  tagMode,
  onTagsChange,
  onTagModeChange,
}: TagFilterProps) {
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagService.getAllTags,
    staleTime: 60_000,
  });

  const toggleTag = useCallback(
    (name: string) => {
      if (selectedTags.includes(name)) {
        onTagsChange(selectedTags.filter((t) => t !== name));
      } else {
        onTagsChange([...selectedTags, name]);
      }
    },
    [selectedTags, onTagsChange]
  );

  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Tag className="size-3.5" />
            Tags
            {selectedTags.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {selectedTags.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-auto">
          <DropdownMenuLabel className="text-xs text-foreground-muted">
            Filter by tags
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag.name}
              checked={selectedTags.includes(tag.name)}
              onCheckedChange={() => toggleTag(tag.name)}
            >
              <span className="flex-1 truncate">{tag.name}</span>
              <span className="text-xs text-foreground-muted ml-2">{tag.entryCount}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedTags.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs px-2 h-7"
          onClick={() => onTagModeChange(tagMode === 'or' ? 'and' : 'or')}
        >
          {tagMode === 'or' ? 'Any' : 'All'}
        </Button>
      )}

      {selectedTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive/10"
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <X className="size-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
});
