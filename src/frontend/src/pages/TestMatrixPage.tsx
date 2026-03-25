import { useQuery } from '@tanstack/react-query';
import { useMemo, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { MatrixComparisonPanel } from '@/components/matrix/MatrixComparisonPanel';
import { MatrixDetailDrawer } from '@/components/matrix/MatrixDetailDrawer';
import { MatrixGrid } from '@/components/matrix/MatrixGrid';
import { MatrixHistoryPanel } from '@/components/matrix/MatrixHistoryPanel';
import { MatrixToolbar } from '@/components/matrix/MatrixToolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMatrixExecution } from '@/hooks/useMatrixExecution';
import { useMatrixState } from '@/hooks/useMatrixState';
import { usePlaygroundTemplateFields } from '@/hooks/usePlaygroundTemplateFields';
import { parseTemplateTags } from '@/lib/templateParser';
import { entryService } from '@/services';
import {
  getEnrichedModels,
  fillTemplateFields,
} from '@/services/api/playgroundService';
import { getDatasets } from '@/services/api/testDatasetService';
import type { TemplateField } from '@/types';

function TestMatrixPage() {
  const { entryId } = useParams<{ entryId: string }>();

  // ── Data fetching ──
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

  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets', entryId],
    queryFn: () => getDatasets(entryId!),
    enabled: !!entryId,
  });

  // ── Template fields ──
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

  const storageKey = `matrix_${entryId}`;
  const { fieldValues, setFieldValues } = usePlaygroundTemplateFields(templateFields, storageKey);

  const [isFillingTemplateFields, setIsFillingTemplateFields] = useState(false);
  const handleFillTemplateFields = useCallback(async () => {
    if (!entryId) return;
    setIsFillingTemplateFields(true);
    try {
      const values = await fillTemplateFields(entryId);
      setFieldValues((prev) => ({ ...prev, ...values }));
      toast.success('Template fields filled');
    } catch {
      toast.error('Failed to fill template fields');
    } finally {
      setIsFillingTemplateFields(false);
    }
  }, [entryId, setFieldValues]);

  // ── History ──
  const [showHistory, setShowHistory] = useState(false);

  // ── Matrix state ──
  const {
    state,
    addVersion,
    addModel,
    selectCell,
    updateCellStatus,
    setCellSegments,
    setCellResult,
    setCellError,
    updateModelParams,
    selectModel,
    selectVersion,
    setComparisonFilter,
    setDataset,
  } = useMatrixState(entryId);

  // ── Matrix execution ──
  const execution = useMatrixExecution({
    entryId,
    state,
    templateFieldValues: fieldValues,
    updateCellStatus,
    setCellSegments,
    setCellResult,
    setCellError,
    selectCell,
  });

  const matrixHasCells = state.versions.length > 0 && state.models.length > 0;
  const hasResults = Object.values(state.cells).some(
    (c) => c.status === 'completed' || c.status === 'running',
  );

  const handleSelectModel = useCallback(
    (modelId: string | null) => {
      selectModel(modelId);
      setComparisonFilter(modelId ? { type: 'model', modelId } : 'all');
    },
    [selectModel, setComparisonFilter],
  );

  const handleSelectVersion = useCallback(
    (versionId: string | null) => {
      selectVersion(versionId);
      setComparisonFilter(versionId ? { type: 'version', versionId } : 'all');
    },
    [selectVersion, setComparisonFilter],
  );

  if (!entryId) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border-subtle shrink-0">
        <MatrixToolbar
          entryId={entryId}
          models={models}
          versions={versions}
          tabs={tabs}
          datasets={datasets}
          selectedDatasetId={state.datasetId}
          onDatasetChange={setDataset}
          template={{
            templateFields,
            fieldValues,
            setFieldValues,
            onFillTemplateFields: templateFields.length > 0 ? handleFillTemplateFields : undefined,
            isFillingTemplateFields,
          }}
          onAddVersion={addVersion}
          onAddModel={addModel}
          onRunAll={execution.runAll}
          onAbortAll={execution.abortAll}
          isRunning={execution.isRunning}
          batchProgress={execution.batchProgress}
          matrixHasCells={matrixHasCells}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory((h) => !h)}
        />
      </div>

      {/* Main area: grid + drawer */}
      <div className="flex-1 flex min-h-0">
        {/* Grid */}
        <ScrollArea className="flex-1 p-4">
          <MatrixGrid
            state={state}
            selectedCell={state.selectedCell}
            selectedModelId={state.selectedModelId}
            selectedVersionId={state.selectedVersionId}
            onSelectCell={(cell) => {
              selectCell(cell);
            }}
            onSelectModel={handleSelectModel}
            onSelectVersion={handleSelectVersion}
            onRunCell={execution.runSingle}
          />
          {hasResults && (
            <MatrixComparisonPanel
              state={state}
              comparisonFilter={state.comparisonFilter}
              onFilterChange={setComparisonFilter}
              activeStreamSegments={execution.activeStreamSegments}
              activeStreamKey={execution.activeStreamKey}
            />
          )}
          {showHistory && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <MatrixHistoryPanel
                entryId={entryId}
                selectedRunId={null}
                onSelectRun={() => {}}
              />
            </div>
          )}
        </ScrollArea>

        {/* Config sidebar */}
        <div className="w-[400px] shrink-0 border-l border-border-subtle bg-surface overflow-hidden">
          <MatrixDetailDrawer
            models={state.models}
            selectedModelId={state.selectedModelId}
            onSelectModel={handleSelectModel}
            onParamChange={updateModelParams}
          />
        </div>
      </div>
    </div>
  );
}

export default TestMatrixPage;
