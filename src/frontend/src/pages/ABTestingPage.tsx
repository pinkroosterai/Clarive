import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, History, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import ABTestHistory from '@/components/abtests/ABTestHistory';
import ABTestProgress from '@/components/abtests/ABTestProgress';
import ABTestResultCard from '@/components/abtests/ABTestResultCard';
import ABTestResults from '@/components/abtests/ABTestResults';
import ABTestSetup from '@/components/abtests/ABTestSetup';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { handleApiError } from '@/lib/handleApiError';
import type {
  AbTestProgressEvent,
  AbTestRunDetail,
  StartAbTestRequest,
} from '@/services/api/abTestService';
import * as abTestService from '@/services/api/abTestService';

type PageView = 'setup' | 'running' | 'results';

const ABTestingPage = () => {
  const { entryId } = useParams<{ entryId?: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [view, setView] = useState<PageView>('setup');
  const [latestEvent, setLatestEvent] = useState<AbTestProgressEvent | null>(null);
  const [completedRunId, setCompletedRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Clarive — A/B Testing';
  }, []);

  // Load full results for completed/selected run
  const viewRunId = completedRunId ?? selectedRunId;
  const { data: runDetail } = useQuery({
    queryKey: ['abtest', entryId, viewRunId],
    queryFn: () => abTestService.getAbTest(entryId!, viewRunId!),
    enabled: !!entryId && !!viewRunId && view === 'results',
  });

  const handleStartTest = useCallback(
    async (testEntryId: string, request: StartAbTestRequest) => {
      setView('running');
      setLatestEvent(null);
      setCompletedRunId(null);
      setSelectedRunId(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await abTestService.startAbTest(
          testEntryId,
          request,
          (event) => setLatestEvent(event),
          controller.signal
        );

        setCompletedRunId(result.id);
        setView('results');
        queryClient.invalidateQueries({ queryKey: ['abtests', testEntryId] });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleApiError(err, { title: 'A/B test failed' });
        }
        setView('setup');
      }
    },
    [queryClient]
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setView('setup');
  }, []);

  const handleSelectHistoryRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setCompletedRunId(null);
    setView('results');
    setActiveTab('new'); // Switch to results view
  }, []);

  const handleNewTest = useCallback(() => {
    setView('setup');
    setCompletedRunId(null);
    setSelectedRunId(null);
    setLatestEvent(null);
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="size-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">A/B Testing</h1>
              <p className="text-sm text-muted-foreground">
                Compare prompt versions side-by-side with quality scoring
              </p>
            </div>
          </div>
          {view === 'results' && (
            <Button variant="outline" size="sm" onClick={handleNewTest}>
              <Plus className="mr-1.5 size-3.5" />
              New Test
            </Button>
          )}
        </div>

        {view === 'running' ? (
          <ABTestProgress latestEvent={latestEvent} onCancel={handleCancel} />
        ) : view === 'results' && runDetail ? (
          <div className="space-y-6">
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
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>
            <TabsList className="mb-6">
              <TabsTrigger value="new" className="gap-1.5">
                <FlaskConical className="size-3.5" />
                New Test
              </TabsTrigger>
              {entryId && (
                <TabsTrigger value="history" className="gap-1.5">
                  <History className="size-3.5" />
                  History
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="new">
              <ABTestSetup
                entryId={entryId}
                onStartTest={handleStartTest}
                isRunning={view === 'running'}
              />
            </TabsContent>

            {entryId && (
              <TabsContent value="history">
                <ABTestHistory entryId={entryId} onSelectRun={handleSelectHistoryRun} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </ScrollArea>
  );
};

export default ABTestingPage;
