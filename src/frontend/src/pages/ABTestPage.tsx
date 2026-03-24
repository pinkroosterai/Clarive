import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import ABTestHistory from '@/components/abtests/ABTestHistory';
import ABTestProgress from '@/components/abtests/ABTestProgress';
import ABTestResultCard from '@/components/abtests/ABTestResultCard';
import ABTestResults from '@/components/abtests/ABTestResults';
import ABTestToolbar from '@/components/abtests/ABTestToolbar';
import DatasetPanel from '@/components/datasets/DatasetPanel';
import DatasetRowEditor from '@/components/datasets/DatasetRowEditor';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleApiError } from '@/lib/handleApiError';
import { parseTemplateTags } from '@/lib/templateParser';
import { entryService } from '@/services';
import type {
  AbTestProgressEvent,
  AbTestRunDetail,
  StartAbTestRequest,
} from '@/services/api/abTestService';
import * as abTestService from '@/services/api/abTestService';
import { getDataset } from '@/services/api/testDatasetService';

type PageView = 'idle' | 'running' | 'results';

const ABTestPage = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const queryClient = useQueryClient();

  const [view, setView] = useState<PageView>('idle');
  const [latestEvent, setLatestEvent] = useState<AbTestProgressEvent | null>(null);
  const [runDetail, setRunDetail] = useState<AbTestRunDetail | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showDatasetManager, setShowDatasetManager] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Clarive — A/B Test';
  }, []);

  const { data: entryData } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId,
  });

  const templateFields = useMemo(() => {
    if (!entryData) return [];
    const allContent = entryData.prompts.map((p) => p.content).join('\n');
    return parseTemplateTags(allContent);
  }, [entryData]);

  const { data: selectedDataset } = useQuery({
    queryKey: ['dataset', entryId, selectedDatasetId],
    queryFn: () => getDataset(entryId!, selectedDatasetId!),
    enabled: !!entryId && !!selectedDatasetId,
  });

  const handleStartTest = useCallback(
    async (request: StartAbTestRequest) => {
      if (!entryId) return;
      setView('running');
      setLatestEvent(null);
      setRunDetail(null);
      setShowHistory(false);
      setShowDatasetManager(false);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await abTestService.startAbTest(
          entryId,
          request,
          (event) => setLatestEvent(event),
          controller.signal
        );

        setRunDetail(result);
        setView('results');
        queryClient.invalidateQueries({ queryKey: ['abtests', entryId] });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleApiError(err, { title: 'A/B test failed' });
        }
        setView('idle');
      }
    },
    [entryId, queryClient]
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setView('idle');
  }, []);

  const handleSelectHistoryRun = useCallback(
    async (runId: string) => {
      if (!entryId) return;
      try {
        const detail = await abTestService.getAbTest(entryId, runId);
        setRunDetail(detail);
        setView('results');
        setShowHistory(false);
      } catch (err) {
        handleApiError(err, { title: 'Failed to load test run' });
      }
    },
    [entryId]
  );

  if (!entryId) return null;

  return (
    <div className="flex h-full flex-col">
      <ABTestToolbar
        entryId={entryId}
        entryTitle={entryData?.title ?? 'Loading...'}
        onRun={handleStartTest}
        isRunning={view === 'running'}
        onManageDatasets={() => setShowDatasetManager((prev) => !prev)}
      />

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-4xl p-6 space-y-4">
          {/* Dataset manager (collapsible) */}
          <Collapsible open={showDatasetManager} onOpenChange={setShowDatasetManager}>
            <CollapsibleContent className="rounded-lg border bg-card p-4">
              {selectedDatasetId && selectedDataset ? (
                <DatasetRowEditor
                  entryId={entryId}
                  datasetId={selectedDatasetId}
                  datasetName={selectedDataset.name}
                  templateFields={templateFields}
                  onBack={() => setSelectedDatasetId(null)}
                />
              ) : (
                <DatasetPanel
                  entryId={entryId}
                  onSelectDataset={(id) => setSelectedDatasetId(id || null)}
                  selectedDatasetId={selectedDatasetId}
                />
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Running state */}
          {view === 'running' && (
            <ABTestProgress latestEvent={latestEvent} onCancel={handleCancel} />
          )}

          {/* Results state */}
          {view === 'results' && runDetail && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setView('idle');
                    setRunDetail(null);
                  }}
                >
                  New Test
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowHistory((prev) => !prev)}
                >
                  <History className="size-3.5" />
                  History
                </Button>
              </div>

              <ABTestResults run={runDetail} />

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Per-Input Comparison</h3>
                {runDetail.results.map((result, i) => (
                  <ABTestResultCard
                    key={result.id}
                    result={result}
                    index={i}
                    versionA={runDetail.versionA}
                    versionB={runDetail.versionB}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Idle state — show history toggle */}
          {view === 'idle' && !showDatasetManager && (
            <div className="flex justify-center pt-8">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setShowHistory((prev) => !prev)}
              >
                <History className="size-3.5" />
                {showHistory ? 'Hide History' : 'Show History'}
              </Button>
            </div>
          )}

          {/* History panel */}
          {showHistory && (
            <div className="rounded-lg border bg-card p-4">
              <ABTestHistory entryId={entryId} onSelectRun={handleSelectHistoryRun} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ABTestPage;
