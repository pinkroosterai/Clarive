import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';

import { MatrixDetailDrawer } from '@/components/matrix/MatrixDetailDrawer';
import { MatrixGrid } from '@/components/matrix/MatrixGrid';
import { MatrixToolbar } from '@/components/matrix/MatrixToolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMatrixExecution } from '@/hooks/useMatrixExecution';
import { useMatrixState } from '@/hooks/useMatrixState';
import { entryService } from '@/services';
import { getEnrichedModels } from '@/services/api/playgroundService';
import { getDatasets } from '@/services/api/testDatasetService';

export function Component() {
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
          onAddVersion={addVersion}
          onAddModel={addModel}
          onRunAll={execution.runAll}
          onAbortAll={execution.abortAll}
          isRunning={execution.isRunning}
          batchProgress={execution.batchProgress}
          matrixHasCells={matrixHasCells}
        />
      </div>

      {/* Main area: grid + drawer */}
      <div className="flex-1 flex min-h-0">
        {/* Grid */}
        <ScrollArea className="flex-1 p-4">
          <MatrixGrid
            state={state}
            selectedCell={state.selectedCell}
            onSelectCell={selectCell}
            onRunCell={execution.runSingle}
          />
        </ScrollArea>

        {/* Detail drawer */}
        <div className="w-[400px] shrink-0 border-l border-border-subtle bg-surface overflow-hidden">
          <MatrixDetailDrawer
            state={state}
            activeStreamSegments={execution.activeStreamSegments}
            activeStreamKey={execution.activeStreamKey}
          />
        </div>
      </div>
    </div>
  );
}

Component.displayName = 'TestMatrixPage';
