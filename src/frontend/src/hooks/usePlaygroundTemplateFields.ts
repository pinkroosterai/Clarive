import { useState, useEffect } from 'react';

import { safeSessionGet } from '@/components/playground/utils';
import type { TemplateField } from '@/types';

/**
 * Manages template field values with sessionStorage persistence
 * and automatic default pre-filling.
 */
export function usePlaygroundTemplateFields(
  templateFields: TemplateField[],
  storageKey: string
) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    safeSessionGet(storageKey + '_fields', {})
  );

  // Persist to sessionStorage on change
  useEffect(() => {
    if (Object.keys(fieldValues).length > 0) {
      sessionStorage.setItem(storageKey + '_fields', JSON.stringify(fieldValues));
    }
  }, [fieldValues, storageKey]);

  // Pre-fill defaults for fields without stored values.
  // Intentionally omits fieldValues from deps — we only want to run this
  // when the set of template fields changes (new entry loaded), not when
  // the user edits a value.
  useEffect(() => {
    if (templateFields.length === 0) return;
    const updates: Record<string, string> = {};
    for (const field of templateFields) {
      if (!fieldValues[field.name]) {
        if (field.defaultValue) {
          updates[field.name] = field.defaultValue;
        } else if (field.min !== null) {
          updates[field.name] = String(field.min);
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setFieldValues((prev) => ({ ...prev, ...updates }));
    }
  }, [templateFields]); // eslint-disable-line react-hooks/exhaustive-deps

  return { fieldValues, setFieldValues };
}
