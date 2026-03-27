import { Document, Page, Text, View } from '@react-pdf/renderer';

import { PdfEvaluationSummarySection } from './PdfEvaluationSummarySection';
import { PdfFullResponsesSection } from './PdfFullResponsesSection';
import { PdfRenderedPromptsSection } from './PdfRenderedPromptsSection';
import { PdfRunConfigSection } from './PdfRunConfigSection';
import { styles } from './pdfStyles';

import type { ReportData } from '@/types/report';

interface ReportPdfDocumentProps {
  data: ReportData;
}

function SectionDivider() {
  return <View style={styles.separator} />;
}

export function ReportPdfDocument({ data }: ReportPdfDocumentProps) {
  const hasPrompts = data.renderedPrompts.some(
    (p) => p.systemMessage || p.renderedPrompts.length > 0
  );
  const hasEvaluations = data.evaluationSummary.some((e) => e.evaluation);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Document header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{data.metadata.entryTitle}</Text>
          <Text style={styles.headerSubtitle}>
            Playground Report — {new Date(data.metadata.generatedAt).toLocaleDateString()} ·{' '}
            {data.metadata.totalVersions} version(s) × {data.metadata.totalModels} model(s) ·{' '}
            {data.metadata.completedCells} completed
          </Text>
        </View>

        {/* Section 1: Run Configuration */}
        <Text style={styles.sectionHeading}>Run Configuration</Text>
        <PdfRunConfigSection models={data.runConfig} templateFields={data.templateFields} />

        <SectionDivider />

        {/* Section 2: Rendered Prompts */}
        {hasPrompts && (
          <>
            <Text style={styles.sectionHeading}>Rendered Prompts</Text>
            <PdfRenderedPromptsSection prompts={data.renderedPrompts} />
            <SectionDivider />
          </>
        )}

        {/* Section 3: Full Responses (page break before — tends to be long) */}
        <View break>
          <Text style={styles.sectionHeading}>Full Responses</Text>
          <PdfFullResponsesSection responses={data.fullResponses} />
        </View>

        {/* Section 4: Evaluation Summary */}
        {hasEvaluations && (
          <>
            <SectionDivider />
            <Text style={styles.sectionHeading}>Evaluation Summary</Text>
            <PdfEvaluationSummarySection entries={data.evaluationSummary} />
          </>
        )}
      </Page>
    </Document>
  );
}
