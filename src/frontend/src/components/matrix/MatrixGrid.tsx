import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Circle, Clock, Loader2, Play, X } from 'lucide-react';
import { memo, useCallback } from 'react';

import { scoreColor } from '@/components/wizard/scoreUtils';
import { cn } from '@/lib/utils';
import type { MatrixState, CellKey, CellStatus } from '@/types/matrix';
import { cellKey, getCell } from '@/types/matrix';

interface MatrixGridProps {
  state: MatrixState;
  selectedCell: CellKey | null;
  selectedModelId: string | null;
  selectedVersionId: string | null;
  onSelectCell: (cell: CellKey) => void;
  onSelectModel: (modelId: string | null) => void;
  onSelectVersion: (versionId: string | null) => void;
  onRemoveModel: (modelId: string) => void;
  onRemoveVersion: (versionId: string) => void;
  onRunCell?: (versionId: string, modelId: string) => void;
  onRunRow?: (versionId: string) => void;
  onRunColumn?: (modelId: string) => void;
}

// ── Memoized cell button — only re-renders when its own status/score/selection changes ──

interface MatrixCellButtonProps {
  versionId: string;
  modelId: string;
  status: CellStatus;
  score: number | null;
  isSelected: boolean;
  versionLabel: string;
  modelName: string;
  onSelect: (cell: CellKey) => void;
  onRun?: (versionId: string, modelId: string) => void;
}

const MatrixCellButton = memo(
  function MatrixCellButton({
    versionId,
    modelId,
    status,
    score,
    isSelected,
    versionLabel,
    modelName,
    onSelect,
    onRun,
  }: MatrixCellButtonProps) {
    const prefersReducedMotion = useReducedMotion();
    const heatmapBg = status === 'completed' && score != null ? scoreColor(score).bg : undefined;

    const canRun = status === 'empty' || status === 'error';

    return (
      <button
        type="button"
        className={cn(
          'group/cell relative flex items-center justify-center w-full h-14 transition-colors cursor-pointer',
          'hover:bg-elevated/50',
          heatmapBg,
          isSelected && 'ring-2 ring-primary ring-inset bg-primary/5',
          status === 'error' && 'bg-error-bg/30',
        )}
        onClick={() => onSelect({ versionId, modelId })}
        onDoubleClick={() => onRun?.(versionId, modelId)}
        aria-label={`${versionLabel} on ${modelName}: ${status}${score != null ? `, score ${score.toFixed(1)}` : ''}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <CellContent status={status} score={score} />
          </motion.div>
        </AnimatePresence>
        {canRun && (
          <div
            role="button"
            tabIndex={-1}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRun?.(versionId, modelId);
            }}
            aria-label={`Run ${versionLabel} on ${modelName}`}
          >
            <Play className="size-3.5 text-primary fill-primary" />
          </div>
        )}
      </button>
    );
  },
  (prev, next) =>
    prev.status === next.status &&
    prev.score === next.score &&
    prev.isSelected === next.isSelected,
);

function CellContent({ status, score }: { status: CellStatus; score: number | null }) {
  switch (status) {
    case 'empty':
      return <Circle className="size-4 text-foreground-muted/40" />;
    case 'queued':
      return <Clock className="size-4 text-foreground-muted" />;
    case 'running':
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case 'completed':
      if (score !== null) {
        const { text } = scoreColor(score);
        return (
          <span className={cn('text-sm font-semibold tabular-nums', text)}>
            {score.toFixed(1)}
          </span>
        );
      }
      return <span className="text-sm font-medium text-success-text">Done</span>;
    case 'error':
      return <AlertTriangle className="size-4 text-error-text" />;
    default:
      return <Circle className="size-4 text-foreground-muted/40" />;
  }
}

// ── Grid ──

export function MatrixGrid({ state, selectedCell, selectedModelId, selectedVersionId, onSelectCell, onSelectModel, onSelectVersion, onRemoveModel, onRemoveVersion, onRunCell, onRunRow, onRunColumn }: MatrixGridProps) {
  const { versions, models } = state;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!selectedCell || versions.length === 0 || models.length === 0) return;

      const vIdx = versions.findIndex((v) => v.id === selectedCell.versionId);
      const mIdx = models.findIndex((m) => m.modelId === selectedCell.modelId);
      if (vIdx === -1 || mIdx === -1) return;

      let nextV = vIdx;
      let nextM = mIdx;

      switch (e.key) {
        case 'ArrowUp':
          nextV = Math.max(0, vIdx - 1);
          e.preventDefault();
          break;
        case 'ArrowDown':
          nextV = Math.min(versions.length - 1, vIdx + 1);
          e.preventDefault();
          break;
        case 'ArrowLeft':
          nextM = Math.max(0, mIdx - 1);
          e.preventDefault();
          break;
        case 'ArrowRight':
          nextM = Math.min(models.length - 1, mIdx + 1);
          e.preventDefault();
          break;
        case 'Enter':
          onRunCell?.(selectedCell.versionId, selectedCell.modelId);
          e.preventDefault();
          return;
        default:
          return;
      }

      if (nextV !== vIdx || nextM !== mIdx) {
        onSelectCell({ versionId: versions[nextV].id, modelId: models[nextM].modelId });
      }
    },
    [selectedCell, versions, models, onSelectCell, onRunCell],
  );

  if (versions.length === 0 && models.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-foreground-muted text-sm">
        Add versions and models to start testing
      </div>
    );
  }

  return (
    <div className="overflow-auto" role="grid" tabIndex={0} onKeyDown={handleKeyDown}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface z-10 p-2 text-left text-xs font-medium text-foreground-muted w-[140px] min-w-[140px]">
              Version
            </th>
            {models.map((model) => (
              <th
                key={model.modelId}
                className={cn(
                  'p-0 text-center text-xs font-medium text-foreground-muted min-w-[100px] group/model',
                  selectedModelId === model.modelId && 'bg-primary/5',
                )}
              >
                <div className="relative">
                  <button
                    type="button"
                    className={cn(
                      'w-full p-2 cursor-pointer transition-colors hover:bg-muted/50 rounded-sm',
                      selectedModelId === model.modelId && 'ring-1 ring-primary/30 ring-inset',
                    )}
                    onClick={() => onSelectModel(selectedModelId === model.modelId ? null : model.modelId)}
                  >
                    <div className="truncate">{model.displayName}</div>
                    <div className="text-[10px] text-foreground-muted/60 font-normal">
                      {model.providerName}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Run all versions on ${model.displayName}`}
                    className="absolute top-0.5 left-0.5 p-0.5 rounded opacity-0 group-hover/model:opacity-100 hover:bg-primary/10 text-foreground-muted hover:text-primary transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunColumn?.(model.modelId);
                    }}
                  >
                    <Play className="size-3 fill-current" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${model.displayName}`}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-0 group-hover/model:opacity-100 hover:bg-error-bg text-foreground-muted hover:text-error-text transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveModel(model.modelId);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id} className="border-t border-border-subtle">
              <td
                className={cn(
                  'sticky left-0 bg-surface z-10 p-0 text-xs font-medium group/version',
                  selectedVersionId === version.id && 'bg-primary/5',
                )}
              >
                <div className="relative">
                  <button
                    type="button"
                    className={cn(
                      'w-full p-2 pr-6 text-left cursor-pointer transition-colors hover:bg-muted/50 rounded-sm',
                      selectedVersionId === version.id && 'ring-1 ring-primary/30 ring-inset',
                    )}
                    onClick={() => onSelectVersion(selectedVersionId === version.id ? null : version.id)}
                  >
                    <div className="truncate max-w-[110px]">{version.label}</div>
                    <div className="text-[10px] text-foreground-muted/60 font-normal capitalize">
                      {version.type}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${version.label}`}
                    className="absolute top-1 right-0.5 p-0.5 rounded opacity-0 group-hover/version:opacity-100 hover:bg-error-bg text-foreground-muted hover:text-error-text transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVersion(version.id);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Run all models on ${version.label}`}
                    className="absolute bottom-1 right-0.5 p-0.5 rounded opacity-0 group-hover/version:opacity-100 hover:bg-primary/10 text-foreground-muted hover:text-primary transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRunRow?.(version.id);
                    }}
                  >
                    <Play className="size-3 fill-current" />
                  </button>
                </div>
              </td>
              {models.map((model) => {
                const cell = getCell(state, version.id, model.modelId);

                return (
                  <td
                    key={cellKey(version.id, model.modelId)}
                    className={cn('p-0 text-center', 'border-l border-border-subtle')}
                    role="gridcell"
                  >
                    <MatrixCellButton
                      versionId={version.id}
                      modelId={model.modelId}
                      status={cell?.status ?? 'empty'}
                      score={cell?.score ?? null}
                      isSelected={
                        selectedCell?.versionId === version.id &&
                        selectedCell?.modelId === model.modelId
                      }
                      versionLabel={version.label}
                      modelName={model.displayName}
                      onSelect={onSelectCell}
                      onRun={onRunCell}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
