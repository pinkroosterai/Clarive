import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { parseTemplateTags } from '@/lib/templateParser';
import { entryService } from '@/services';
import { getEnrichedModels } from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

export function useMatrixPageData(entryId: string | undefined) {
  const { data: entry } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId,
  });

  const { data: tabs = [] } = useQuery({
    queryKey: ['tabs', entryId],
    queryFn: () => entryService.listTabs(entryId!),
    enabled: !!entryId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['versions', entryId],
    queryFn: () => entryService.getVersionHistory(entryId!),
    enabled: !!entryId,
  });

  const { data: models = [] } = useQuery({
    queryKey: ['enriched-models'],
    queryFn: getEnrichedModels,
  });

  const templateFields = useMemo<TemplateField[]>(() => {
    if (!entry) return [];
    const seen = new Set<string>();
    const fields: TemplateField[] = [];
    for (const prompt of entry.prompts) {
      for (const f of parseTemplateTags(prompt.content)) {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          fields.push(f);
        }
      }
    }
    return fields;
  }, [entry]);

  return { entry, tabs, versions, models, templateFields };
}
