import { Text, View } from '@react-pdf/renderer';

import { styles } from './pdfStyles';

import type { StreamSegment } from '@/hooks/streamingTypes';
import type { FullResponseEntry } from '@/types/report';

interface PdfFullResponsesSectionProps {
  responses: FullResponseEntry[];
}

function extractText(segments: StreamSegment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.type === 'reasoning') {
      parts.push(`[Reasoning] ${seg.text}`);
    } else if (seg.type === 'tool_call') {
      parts.push(`[Tool: ${seg.toolName}]`);
    } else if (seg.type === 'response') {
      parts.push(seg.text);
    }
    // tool_result is rendered as part of tool_call context — skip in PDF
  }
  return parts.join('\n\n');
}

export function PdfFullResponsesSection({ responses }: PdfFullResponsesSectionProps) {
  return (
    <View>
      {responses.map((entry, i) => (
        <View key={i} style={styles.card} wrap={false}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={[styles.bodyText, { fontFamily: 'Helvetica-Bold' }]}>
              {entry.versionLabel} × {entry.modelDisplayName}
            </Text>
            {entry.elapsedMs != null && (
              <Text style={styles.smallText}>{(entry.elapsedMs / 1000).toFixed(1)}s</Text>
            )}
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            {entry.error ? (
              <Text style={[styles.bodyText, { color: '#dc2626' }]}>Error: {entry.error}</Text>
            ) : (
              <Text style={[styles.bodyText, { lineHeight: 1.6 }]}>
                {extractText(entry.segments)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
