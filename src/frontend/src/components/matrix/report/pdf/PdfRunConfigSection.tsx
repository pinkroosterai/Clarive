import { Text, View } from '@react-pdf/renderer';

import { styles } from './pdfStyles';

import type { RunConfigEntry, TemplateFieldEntry } from '@/types/report';

interface PdfRunConfigSectionProps {
  models: RunConfigEntry[];
  templateFields: TemplateFieldEntry[];
}

export function PdfRunConfigSection({ models, templateFields }: PdfRunConfigSectionProps) {
  return (
    <View>
      {/* Model configuration table */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Model</Text>
        <Text style={styles.tableHeaderCell}>Provider</Text>
        <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Temp</Text>
        <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Max Tokens</Text>
        <Text style={styles.tableHeaderCell}>Reasoning</Text>
      </View>
      {models.map((m) => (
        <View key={m.modelId} style={styles.tableRow}>
          <Text style={[styles.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>
            {m.displayName}
          </Text>
          <Text style={styles.tableCell}>{m.providerName}</Text>
          <Text style={styles.tableCellRight}>{m.temperature}</Text>
          <Text style={styles.tableCellRight}>{m.maxTokens.toLocaleString()}</Text>
          <Text style={[styles.tableCell, { textTransform: 'capitalize' }]}>
            {m.reasoningEffort}
          </Text>
        </View>
      ))}

      {/* Template field values */}
      {templateFields.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.label}>Template Variables</Text>
          {templateFields.map((f) => (
            <View key={f.name} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{`{{${f.name}}}`}</Text>
              <Text style={styles.fieldValue}>{f.value || '(empty)'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
