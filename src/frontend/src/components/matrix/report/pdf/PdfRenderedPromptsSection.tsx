import { Text, View } from '@react-pdf/renderer';

import { styles } from './pdfStyles';

import type { RenderedPromptEntry } from '@/types/report';

interface PdfRenderedPromptsSectionProps {
  prompts: RenderedPromptEntry[];
}

export function PdfRenderedPromptsSection({ prompts }: PdfRenderedPromptsSectionProps) {
  return (
    <View>
      {prompts.map((entry, i) => (
        <View key={i} style={{ marginBottom: 12 }}>
          <Text style={[styles.bodyText, { fontFamily: 'Helvetica-Bold', marginBottom: 6 }]}>
            {entry.versionLabel}
          </Text>

          {entry.systemMessage && (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.label}>System Message</Text>
              <Text style={styles.monoText}>{entry.systemMessage}</Text>
            </View>
          )}

          {entry.renderedPrompts.map((prompt, j) => (
            <View key={j} style={{ marginBottom: 8 }}>
              <Text style={styles.label}>
                {entry.renderedPrompts.length > 1 ? `Prompt ${j + 1}` : 'User Prompt'}
              </Text>
              <Text style={styles.monoText}>{prompt}</Text>
            </View>
          ))}

          {!entry.systemMessage && entry.renderedPrompts.length === 0 && (
            <Text style={[styles.bodyText, { color: '#9ca3af', fontStyle: 'italic' }]}>
              No prompt content available
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
