import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { HelpLink } from '@/components/common/HelpLink';
import { MatrixComparisonPanel } from '@/components/matrix/MatrixComparisonPanel';
import { MatrixDetailDrawer } from '@/components/matrix/MatrixDetailDrawer';
import { MatrixGrid } from '@/components/matrix/MatrixGrid';
import { MatrixHistoryPanel } from '@/components/matrix/MatrixHistoryPanel';
import { MatrixToolbar } from '@/components/matrix/MatrixToolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMatrixExecution } from '@/hooks/useMatrixExecution';
import { useMatrixState } from '@/hooks/useMatrixState';
import { usePlaygroundTemplateFields } from '@/hooks/usePlaygroundTemplateFields';
import { usePlaygroundTools } from '@/hooks/usePlaygroundTools';
import { safeSessionGet } from '@/components/playground/utils';
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

  // ── Tools ──
  const {
    enabledServerIds, setEnabledServerIds,
    excludedToolNames, setExcludedToolNames,
    mcpServers, allTools,
  } = usePlaygroundTools();

  // Restore tool config from sessionStorage (overrides hook's auto-enable)
  const didRestoreToolsRef = useRef(false);
  useEffect(() => {
    if (!entryId || didRestoreToolsRef.current || mcpServers.length === 0) return;
    const saved = safeSessionGet<{ enabledServerIds: string[]; excludedToolNames: string[] } | null>(
      `matrix_${entryId}_tools`, null,
    );
    if (saved) {
      didRestoreToolsRef.current = true;
      setEnabledServerIds(saved.enabledServerIds);
      setExcludedToolNames(saved.excludedToolNames);
    } else {
      // First visit — mark as restored so persist effect can start writing
      didRestoreToolsRef.current = true;
    }
  }, [entryId, mcpServers, setEnabledServerIds, setExcludedToolNames]);

  // Persist tool config to sessionStorage on change
  useEffect(() => {
    if (!entryId || !didRestoreToolsRef.current) return;
    sessionStorage.setItem(
      `matrix_${entryId}_tools`,
      JSON.stringify({ enabledServerIds, excludedToolNames }),
    );
  }, [entryId, enabledServerIds, excludedToolNames]);

  // ── Sidebar collapse ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    safeSessionGet<boolean>(`matrix_${entryId}_sidebar`, false),
  );
  useEffect(() => {
    if (!entryId) return;
    sessionStorage.setItem(`matrix_${entryId}_sidebar`, JSON.stringify(sidebarCollapsed));
  }, [entryId, sidebarCollapsed]);

  // ── History ──
  const [showHistory, setShowHistory] = useState(false);

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
    updateModelParams,
    selectModel,
    selectVersion,
    setComparisonFilter,
    setDataset,
    clearMatrix,
  } = useMatrixState(entryId);

  // ── Matrix execution ──
  const execution = useMatrixExecution({
    entryId,
    state,
    templateFieldValues: fieldValues,
    enabledServerIds,
    excludedToolNames,
    updateCellStatus,
    setCellSegments,
    setCellResult,
    setCellError,
    selectCell,
  });

  const matrixHasCells = state.versions.length > 0 && state.models.length > 0;
  const addedVersionIds = useMemo(() => new Set(state.versions.map((v) => v.id)), [state.versions]);
  const addedModelIds = useMemo(() => new Set(state.models.map((m) => m.modelId)), [state.models]);
  const hasResults = Object.values(state.cells).some(
    (c) => c.status === 'completed' || c.status === 'running',
  );

  const handleExpandToSection = useCallback(() => {
    setSidebarCollapsed(false);
    if (state.models.length > 0 && !state.selectedModelId) {
      selectModel(state.models[0].modelId);
    }
  }, [state.models, state.selectedModelId, selectModel]);

  // ── Version content for sidebar preview ──
  const selectedVersion = state.selectedVersionId
    ? state.versions.find((v) => v.id === state.selectedVersionId)
    : null;

  const { data: versionContent, isLoading: versionContentLoading } = useQuery({
    queryKey: ['version-content', entryId, state.selectedVersionId],
    queryFn: () => {
      if (!entryId || !selectedVersion) return null;
      if (selectedVersion.type === 'tab') {
        return entryService.getTab(entryId, selectedVersion.id);
      }
      return entryService.getVersion(entryId, selectedVersion.version!);
    },
    enabled: !!entryId && !!state.selectedVersionId && !!selectedVersion,
  });

  const handleSelectModel = useCallback(
    (modelId: string | null) => {
      selectModel(modelId);
      selectVersion(null);
      selectCell(null);
      setComparisonFilter(modelId ? { type: 'model', modelId } : 'all');
    },
    [selectModel, selectVersion, selectCell, setComparisonFilter],
  );

  const handleSelectVersion = useCallback(
    (versionId: string | null) => {
      selectVersion(versionId);
      selectModel(null);
      selectCell(null);
      setComparisonFilter(versionId ? { type: 'version', versionId } : 'all');
    },
    [selectVersion, selectModel, selectCell, setComparisonFilter],
  );

  if (!entryId) return null;

  return (
    <div className={`grid h-full ${sidebarCollapsed ? 'grid-cols-[minmax(0,1fr)_48px]' : 'grid-cols-[minmax(0,1fr)_360px]'} transition-[grid-template-columns] duration-200`}>
      {/* Left column: header + action bar + grid */}
      <div className="flex flex-col min-h-0">
        {/* Page header */}
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Playground</h1>
            <HelpLink section="playground" />
          </div>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2 border-b border-border-subtle shrink-0">
          <MatrixToolbar
            entryId={entryId}
            onRunAll={execution.runAll}
            onAbortAll={execution.abortAll}
            isRunning={execution.isRunning}
            batchProgress={execution.batchProgress}
            matrixHasCells={matrixHasCells}
            onClearMatrix={clearMatrix}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory((h) => !h)}
          />
        </div>

        {/* Grid */}
        <ScrollArea className="flex-1 p-4">
          <MatrixGrid
            state={state}
            selectedCell={state.selectedCell}
            selectedModelId={state.selectedModelId}
            selectedVersionId={state.selectedVersionId}
            onSelectCell={(cell) => {
              selectCell(cell);
              selectModel(null);
              selectVersion(null);
              setSidebarCollapsed(false);
            }}
            onSelectModel={handleSelectModel}
            onSelectVersion={handleSelectVersion}
            onRemoveModel={removeModel}
            onRemoveVersion={removeVersion}
            onRunCell={execution.runSingle}
            onRunRow={execution.runRow}
            onRunColumn={execution.runColumn}
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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 pt-4 border-t border-border-subtle"
            >
              <MatrixHistoryPanel
                entryId={entryId}
                selectedRunId={null}
                onSelectRun={() => {}}
              />
            </motion.div>
          )}
        </ScrollArea>
      </div>

      {/* Right column: full-height sidebar */}
      <div className="bg-surface border-l border-border-subtle p-4 h-full overflow-hidden">
        <MatrixDetailDrawer
          entryId={entryId}
          models={state.models}
          versions={state.versions}
          selectedModelId={state.selectedModelId}
          selectedVersionId={state.selectedVersionId}
          selectedCell={state.selectedCell}
          cells={state.cells}
          versionContent={versionContent ?? undefined}
          versionContentLoading={versionContentLoading}
          fieldValues={fieldValues}
          onSelectModel={handleSelectModel}
          onParamChange={updateModelParams}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onExpandToSection={handleExpandToSection}
          setupProps={{
            models,
            versions,
            tabs,
            datasets,
            selectedDatasetId: state.datasetId,
            onDatasetChange: setDataset,
            template: {
              templateFields,
              fieldValues,
              setFieldValues,
              onFillTemplateFields: templateFields.length > 0 ? handleFillTemplateFields : undefined,
              isFillingTemplateFields,
            },
            onAddVersion: addVersion,
            onAddModel: addModel,
            mcpServers,
            allTools,
            enabledServerIds,
            setEnabledServerIds,
            excludedToolNames,
            setExcludedToolNames,
            addedVersionIds,
            addedModelIds,
          }}
        />
      </div>
    </div>
  );
}

export default TestMatrixPage;
