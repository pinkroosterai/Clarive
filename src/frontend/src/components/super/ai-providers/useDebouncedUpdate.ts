import { useEffect, useRef, useState } from 'react';

export function useDebouncedUpdate(
  modelId: string,
  field: string,
  serverValue: string | number | null | undefined,
  onUpdate: (modelId: string, data: Record<string, unknown>) => void,
  transform: (value: string) => unknown,
  delay = 500
) {
  const [localValue, setLocalValue] = useState(String(serverValue ?? ''));
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLocalEdit = useRef(false);

  // Sync from server when not actively editing
  useEffect(() => {
    if (!isLocalEdit.current) {
      setLocalValue(String(serverValue ?? ''));
    }
  }, [serverValue]);

  const handleChange = (value: string) => {
    isLocalEdit.current = true;
    setLocalValue(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdate(modelId, { [field]: transform(value) });
      isLocalEdit.current = false;
    }, delay);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { localValue, handleChange };
}
