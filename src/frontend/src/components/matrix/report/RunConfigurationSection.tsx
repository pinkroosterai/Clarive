import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RunConfigEntry, TemplateFieldEntry } from '@/types/report';

interface RunConfigurationSectionProps {
  models: RunConfigEntry[];
  templateFields: TemplateFieldEntry[];
}

export function RunConfigurationSection({ models, templateFields }: RunConfigurationSectionProps) {
  return (
    <div className="space-y-6">
      {/* Model configuration table */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Models</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Temperature</TableHead>
              <TableHead className="text-right">Max Tokens</TableHead>
              <TableHead>Reasoning Effort</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.modelId}>
                <TableCell className="font-medium">{m.displayName}</TableCell>
                <TableCell>{m.providerName}</TableCell>
                <TableCell className="text-right font-mono">{m.temperature}</TableCell>
                <TableCell className="text-right font-mono">
                  {m.maxTokens.toLocaleString()}
                </TableCell>
                <TableCell className="capitalize">{m.reasoningEffort}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Template field values */}
      {templateFields.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Template Variables</h4>
          <div className="rounded-lg border border-border-subtle">
            {templateFields.map((f, i) => (
              <div
                key={f.name}
                className={`flex items-baseline gap-4 px-4 py-2.5 ${i < templateFields.length - 1 ? 'border-b border-border-subtle' : ''}`}
              >
                <span className="text-sm font-medium min-w-[120px] shrink-0 font-mono">
                  {`{{${f.name}}}`}
                </span>
                <span className="text-sm text-muted-foreground">{f.value || '(empty)'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
