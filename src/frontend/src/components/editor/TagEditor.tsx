import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, X } from 'lucide-react';
import { useState, useRef, memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { handleApiError } from '@/lib/handleApiError';
import * as tagService from '@/services/api/tagService';
import { useAuthStore } from '@/store/authStore';

interface TagEditorProps {
  entryId: string;
  readOnly?: boolean;
}

export const TagEditor = memo(function TagEditor({ entryId, readOnly = false }: TagEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentUser?.role);
  const canEdit = !readOnly && (role === 'admin' || role === 'editor');

  const { data: entryTags = [] } = useQuery({
    queryKey: ['entry-tags', entryId],
    queryFn: () => tagService.getEntryTags(entryId),
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagService.getAllTags,
    staleTime: 60_000,
    enabled: canEdit,
  });

  const addMutation = useMutation({
    mutationFn: (tags: string[]) => tagService.addTags(entryId, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry-tags', entryId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to add tag' }),
  });

  const removeMutation = useMutation({
    mutationFn: (tagName: string) => tagService.removeTag(entryId, tagName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry-tags', entryId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to remove tag' }),
  });

  const handleAdd = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || entryTags.includes(normalized)) return;
    addMutation.mutate([normalized]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(inputValue);
    }
  };

  const suggestions = allTags
    .map((t) => t.name)
    .filter((name) => !entryTags.includes(name) && name.includes(inputValue.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      {entryTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entryTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs">
              {tag}
              {canEdit && (
                <button
                  className="hover:text-destructive transition-colors"
                  onClick={() => removeMutation.mutate(tag)}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="relative">
          <div className="flex items-center gap-1.5">
            <Tag className="size-3.5 text-foreground-muted shrink-0" />
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Add tag..."
              className="h-7 text-xs"
            />
          </div>
          {showSuggestions && inputValue && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border-subtle bg-surface elevation-3 py-1">
              {suggestions.map((name) => (
                <button
                  key={name}
                  className="w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-background-elevated transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAdd(name);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!canEdit && entryTags.length === 0 && (
        <p className="text-xs text-foreground-muted">No tags</p>
      )}
    </div>
  );
});
