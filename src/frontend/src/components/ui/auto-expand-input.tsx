import { useEffect, useRef } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const AUTO_EXPAND_THRESHOLD = 80;

interface AutoExpandInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxHeight?: number;
}

/**
 * Input that auto-expands to a textarea when content exceeds
 * ~80 characters or contains newlines. Auto-grows with content
 * up to maxHeight, then scrolls.
 */
export function AutoExpandInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  maxHeight = 200,
}: AutoExpandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const needsTextarea = value.length > AUTO_EXPAND_THRESHOLD || value.includes('\n');

  // Auto-resize textarea height based on content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  if (needsTextarea) {
    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('resize-none overflow-auto', className)}
        style={{ maxHeight }}
      />
    );
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
