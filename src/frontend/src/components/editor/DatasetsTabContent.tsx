import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import DatasetPanel from '@/components/datasets/DatasetPanel';
import DatasetRowEditor from '@/components/datasets/DatasetRowEditor';
import * as testDatasetService from '@/services/api/testDatasetService';
import type { TemplateField } from '@/types';

interface DatasetsTabContentProps {
  entryId: string;
  templateFields: TemplateField[];
}

export function DatasetsTabContent({ entryId, templateFields }: DatasetsTabContentProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  const { data: selectedDataset } = useQuery({
    queryKey: ['dataset', entryId, selectedDatasetId],
    queryFn: () => testDatasetService.getDataset(entryId, selectedDatasetId!),
    enabled: !!selectedDatasetId,
  });

  if (selectedDatasetId && selectedDataset) {
    return (
      <DatasetRowEditor
        entryId={entryId}
        datasetId={selectedDatasetId}
        datasetName={selectedDataset.name}
        templateFields={templateFields}
        onBack={() => setSelectedDatasetId(null)}
      />
    );
  }

  return (
    <DatasetPanel
      entryId={entryId}
      onSelectDataset={(id) => setSelectedDatasetId(id || null)}
      selectedDatasetId={selectedDatasetId}
    />
  );
}
