import { useState, useRef, useEffect } from 'react';

import { Input } from '@/components/ui/input';

interface InlineInputProps {
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InlineInput({ defaultValue = '', onSubmit, onCancel }: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
    else onCancel();
  };

  return (
    <Input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') {
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!cancelledRef.current) handleSubmit();
      }}
      className="h-6 px-1 py-0 text-sm"
    />
  );
}
