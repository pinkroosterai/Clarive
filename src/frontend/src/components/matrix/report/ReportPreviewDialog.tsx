import { pdf } from '@react-pdf/renderer';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { EvaluationSummarySection } from './EvaluationSummarySection';
import { FullResponsesSection } from './FullResponsesSection';
import { buildPdfFilename } from './pdf/pdfFilename';
import { ReportPdfDocument } from './pdf/ReportPdfDocument';
import { RenderedPromptsSection } from './RenderedPromptsSection';
import { RunConfigurationSection } from './RunConfigurationSection';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { ReportData } from '@/types/report';

interface ReportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ReportData | null;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold tracking-tight">{children}</h3>;
}

export function ReportPreviewDialog({ isOpen, onClose, reportData }: ReportPreviewDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!reportData) return;
    setIsGenerating(true);
    try {
      const blob = await pdf(<ReportPdfDocument data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildPdfFilename(reportData.metadata.entryTitle);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }, [reportData]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-4xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            {reportData
              ? `${reportData.metadata.entryTitle} — Playground Report`
              : 'Playground Report'}
          </SheetTitle>
          <SheetDescription>
            {reportData
              ? `Generated ${new Date(reportData.metadata.generatedAt).toLocaleString()} · ${reportData.metadata.totalVersions} version(s) × ${reportData.metadata.totalModels} model(s) · ${reportData.metadata.completedCells} completed`
              : 'No results to report'}
          </SheetDescription>
          {reportData && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-2"
              disabled={isGenerating}
              onClick={handleDownloadPdf}
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isGenerating ? 'Generating...' : 'Download PDF'}
            </Button>
          )}
        </SheetHeader>

        {reportData ? (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              {/* Section 1: Run Configuration */}
              <div className="space-y-3">
                <SectionHeading>Run Configuration</SectionHeading>
                <RunConfigurationSection
                  models={reportData.runConfig}
                  templateFields={reportData.templateFields}
                />
              </div>

              <Separator />

              {/* Section 2: Rendered Prompts */}
              {reportData.renderedPrompts.some(
                (p) => p.systemMessage || p.renderedPrompts.length > 0
              ) && (
                <>
                  <div className="space-y-3">
                    <SectionHeading>Rendered Prompts</SectionHeading>
                    <RenderedPromptsSection prompts={reportData.renderedPrompts} />
                  </div>
                  <Separator />
                </>
              )}

              {/* Section 3: Full Responses */}
              <div className="space-y-3">
                <SectionHeading>Full Responses</SectionHeading>
                <FullResponsesSection responses={reportData.fullResponses} />
              </div>

              <Separator />

              {/* Section 4: Evaluation Summary */}
              {reportData.evaluationSummary.some((e) => e.evaluation) && (
                <div className="space-y-3">
                  <SectionHeading>Evaluation Summary</SectionHeading>
                  <EvaluationSummarySection entries={reportData.evaluationSummary} />
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Run at least one matrix cell to generate a report.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
