import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { PLAYGROUND_DEFAULTS } from '@/lib/constants';
import type { MatrixModel } from '@/types/matrix';

interface ModelConfigPanelProps {
  model: MatrixModel;
  onParamChange: (params: Partial<Pick<MatrixModel, 'temperature' | 'maxTokens' | 'reasoningEffort' | 'showReasoning'>>) => void;
}

export function ModelConfigPanel({ model, onParamChange }: ModelConfigPanelProps) {
  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{model.displayName}</h3>
        <Badge variant="secondary" className="text-xs">
          {model.providerName}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Temperature (hidden for reasoning models) */}
        {!model.isReasoning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground-muted">Temperature</Label>
              <span className="text-xs text-foreground-muted tabular-nums">
                {model.temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[model.temperature]}
              onValueChange={([v]) => onParamChange({ temperature: v })}
              min={0}
              max={2}
              step={0.1}
            />
          </div>
        )}

        {/* Reasoning controls (shown for reasoning models) */}
        {model.isReasoning && (
          <>
            <div className="space-y-2">
              <Label className="text-xs text-foreground-muted">Reasoning effort</Label>
              <Select
                value={model.reasoningEffort}
                onValueChange={(v) => onParamChange({ reasoningEffort: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-xs">Low</SelectItem>
                  <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                  <SelectItem value="high" className="text-xs">High</SelectItem>
                  <SelectItem value="extra-high" className="text-xs">Extra High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-foreground-muted">Show thinking</Label>
              <input
                type="checkbox"
                checked={model.showReasoning}
                onChange={(e) => onParamChange({ showReasoning: e.target.checked })}
                className="size-3.5 rounded"
              />
            </div>
          </>
        )}

        {/* Max tokens */}
        <div className="space-y-2">
          <Label className="text-xs text-foreground-muted">Max tokens</Label>
          <Input
            type="number"
            value={model.maxTokens}
            onChange={(e) =>
              onParamChange({
                maxTokens: Math.max(
                  1,
                  Math.min(Number(e.target.value) || PLAYGROUND_DEFAULTS.MAX_TOKENS, 128000),
                ),
              })
            }
            onBlur={(e) => {
              if (!e.target.value || Number(e.target.value) < 1)
                onParamChange({ maxTokens: PLAYGROUND_DEFAULTS.MAX_TOKENS });
            }}
            className="h-8 text-xs"
            min={1}
          />
        </div>
      </div>
    </div>
  );
}
