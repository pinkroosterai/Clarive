import { Button } from '@/components/ui/button';

export type DatePreset = '24h' | '7d' | '30d' | '90d';

interface AiUsageDateFilterProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

const presets: { label: string; value: DatePreset }[] = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
];

export function getDateRange(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = now.toISOString();
  const from = new Date(now);

  switch (preset) {
    case '24h':
      from.setHours(from.getHours() - 24);
      break;
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
  }

  return { dateFrom: from.toISOString(), dateTo };
}

export default function AiUsageDateFilter({ value, onChange }: AiUsageDateFilterProps) {
  return (
    <div className="flex items-center gap-1">
      {presets.map((p) => (
        <Button
          key={p.value}
          variant={value === p.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
