import { Text, View } from '@react-pdf/renderer';

import { pdfScoreBgColor, pdfScoreColor, styles } from './pdfStyles';

import type { EvaluationSummaryEntry } from '@/types/report';

interface PdfEvaluationSummarySectionProps {
  entries: EvaluationSummaryEntry[];
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <Text style={[styles.tableCellRight, { textAlign: 'center' }]}>—</Text>;
  }
  return (
    <Text
      style={[
        styles.scoreBadge,
        { color: pdfScoreColor(score), backgroundColor: pdfScoreBgColor(score) },
      ]}
    >
      {score.toFixed(1)}
    </Text>
  );
}

export function PdfEvaluationSummarySection({ entries }: PdfEvaluationSummarySectionProps) {
  if (entries.length === 0) return null;

  const dimensionNames = Array.from(
    new Set(entries.flatMap((e) => (e.evaluation ? Object.keys(e.evaluation.dimensions) : [])))
  ).sort();

  return (
    <View>
      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Version</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Model</Text>
        {dimensionNames.map((dim) => (
          <Text key={dim} style={[styles.tableHeaderCell, { textAlign: 'center' }]}>
            {dim}
          </Text>
        ))}
        <Text style={[styles.tableHeaderCell, { textAlign: 'center' }]}>Avg</Text>
      </View>

      {/* Table rows */}
      {entries.map((entry, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>
            {entry.versionLabel}
          </Text>
          <Text style={[styles.tableCell, { flex: 2 }]}>{entry.modelDisplayName}</Text>
          {dimensionNames.map((dim) => (
            <View key={dim} style={{ flex: 1, alignItems: 'center' }}>
              <ScoreBadge score={entry.evaluation?.dimensions[dim]?.score ?? null} />
            </View>
          ))}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <ScoreBadge score={entry.averageScore} />
          </View>
        </View>
      ))}

      {/* Feedback details */}
      {entries.some((e) => e.evaluation) && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.label, { marginBottom: 8 }]}>Evaluation Feedback</Text>
          {entries
            .filter((e) => e.evaluation)
            .map((entry, i) => (
              <View key={i} style={[styles.card, { marginBottom: 6 }]}>
                <View style={[styles.cardHeader, { paddingVertical: 4 }]}>
                  <Text style={[styles.smallText, { fontFamily: 'Helvetica-Bold' }]}>
                    {entry.versionLabel} × {entry.modelDisplayName}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  {Object.entries(entry.evaluation!.dimensions).map(([dim, d]) => (
                    <View key={dim} style={{ flexDirection: 'row', marginBottom: 3 }}>
                      <Text style={[styles.smallText, { fontFamily: 'Helvetica-Bold', width: 80 }]}>
                        {dim} ({d.score})
                      </Text>
                      <Text style={[styles.smallText, { flex: 1 }]}>{d.feedback}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}
