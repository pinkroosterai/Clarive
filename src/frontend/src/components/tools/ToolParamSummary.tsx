interface ToolParamSummaryProps {
  schema?: Record<string, unknown>;
  className?: string;
}

export function ToolParamSummary({ schema, className }: ToolParamSummaryProps) {
  if (!schema) return null;
  const properties = schema.properties as Record<string, { type?: string }> | undefined;
  if (!properties) return null;

  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);

  const params = Object.entries(properties).map(([name, def]) => {
    const type = def?.type ?? 'any';
    const req = required.has(name) ? ', required' : '';
    return `${name} (${type}${req})`;
  });

  if (params.length === 0) return null;

  return (
    <p className={className ?? 'text-xs text-foreground-muted/70 line-clamp-1'}>
      Parameters: {params.join(', ')}
    </p>
  );
}
