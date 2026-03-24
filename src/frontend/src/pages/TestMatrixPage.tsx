import { useQuery } from '@tanstack/react-query';
import { useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  type TestRunResponse,
} from '@/services/api/playgroundService';
import { getDatasets } from '@/services/api/testDatasetService';
import type { TemplateField } from '@/types';

function TestMatrixPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();

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
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<TestRunResponse | null>(null);

  // ── Matrix state ──
  const {
    state,
    addVersion,
    removeVersion,
    addModel,
    removeModel,
    selectCell,
    updateCellStatus,
    setCellSegments,
    setCellResult,
    setCellError,
    setDataset,
    clearMatrix,
  } = useMatrixState();

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
            onSelectCell={(cell) => {
              setSelectedHistoryRun(null);
              selectCell(cell);
            }}
            onRunCell={execution.runSingle}
          />
          {showHistory && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <MatrixHistoryPanel
                entryId={entryId}
                selectedRunId={selectedHistoryRun?.id ?? null}
                onSelectRun={(run) => {
                  setSelectedHistoryRun(run);
                  selectCell(null);
                }}
              />
            </div>
          )}
        </ScrollArea>

        {/* Detail drawer */}
        <div className="w-[400px] shrink-0 border-l border-border-subtle bg-surface overflow-hidden">
          <MatrixDetailDrawer
            state={state}
            activeStreamSegments={execution.activeStreamSegments}
            activeStreamKey={execution.activeStreamKey}
            historyRun={selectedHistoryRun}
          />
        </div>
      </div>
    </div>
  );
}

export default TestMatrixPage;
