import { useMemo } from 'react';

import type { TemplateField } from '@/types';
import type { MatrixState } from '@/types/matrix';
import type {
  ReportData,
  RunConfigEntry,
  TemplateFieldEntry,
  RenderedPromptEntry,
  FullResponseEntry,
  EvaluationSummaryEntry,
} from '@/types/report';

export interface VersionContent {
  systemMessage: string | null;
  prompts: { content: string }[];
}

interface UseReportDataParams {
  state: MatrixState;
  fieldValues: Record<string, string>;
  templateFields: TemplateField[];
  entryTitle: string;
  /** Map of version ID → prompt content. Missing entries are skipped in Rendered Prompts. */
  versionContents?: Record<string, VersionContent | undefined>;
}

function substituteVariables(text: string, fieldValues: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => fieldValues[name] ?? match);
}

export function useReportData({
  state,
  fieldValues,
  templateFields,
  entryTitle,
  versionContents,
}: UseReportDataParams): ReportData | null {
  return useMemo(() => {
    const completedCells = Object.values(state.cells).filter((c) => c.status === 'completed');
    if (completedCells.length === 0) return null;

    // Section 1: Run Configuration
    const runConfig: RunConfigEntry[] = state.models.map((m) => ({
      modelId: m.modelId,
      displayName: m.displayName,
      providerName: m.providerName,
      temperature: m.temperature,
      maxTokens: m.maxTokens,
      reasoningEffort: m.reasoningEffort,
    }));

    const templateFieldEntries: TemplateFieldEntry[] = templateFields.map((f) => ({
      name: f.name,
      value: fieldValues[f.name] ?? '',
      type: f.type,
    }));

    // Section 2: Rendered Prompts
    const renderedPrompts: RenderedPromptEntry[] = state.versions.map((v) => {
      const content = versionContents?.[v.id];
      return {
        versionLabel: v.label,
        systemMessage: content?.systemMessage
          ? substituteVariables(content.systemMessage, fieldValues)
          : null,
        renderedPrompts: (content?.prompts ?? []).map((p) =>
          substituteVariables(p.content, fieldValues)
        ),
      };
    });

    // Section 3: Full Responses
    const fullResponses: FullResponseEntry[] = [];
    for (const version of state.versions) {
      for (const model of state.models) {
        const cell = state.cells[`${version.id}:${model.modelId}`];
        if (!cell || (cell.status !== 'completed' && cell.status !== 'error')) continue;
        fullResponses.push({
          versionLabel: version.label,
          modelDisplayName: model.displayName,
          segments: cell.segments,
          elapsedMs: cell.elapsedMs,
          error: cell.error,
        });
      }
    }

    // Section 4: Evaluation Summary
    const evaluationSummary: EvaluationSummaryEntry[] = [];
    for (const version of state.versions) {
      for (const model of state.models) {
        const cell = state.cells[`${version.id}:${model.modelId}`];
        if (!cell || cell.status !== 'completed') continue;
        evaluationSummary.push({
          versionLabel: version.label,
          modelDisplayName: model.displayName,
          evaluation: cell.evaluation,
          averageScore: cell.evaluation?.averageScore ?? null,
        });
      }
    }

    return {
      metadata: {
        entryTitle,
        generatedAt: new Date().toISOString(),
        totalVersions: state.versions.length,
        totalModels: state.models.length,
        completedCells: completedCells.length,
      },
      runConfig,
      templateFields: templateFieldEntries,
      renderedPrompts,
      fullResponses,
      evaluationSummary,
    };
  }, [state, fieldValues, templateFields, entryTitle, versionContents]);
}
