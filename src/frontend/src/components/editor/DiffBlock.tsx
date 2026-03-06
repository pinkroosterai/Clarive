import { diffLines } from 'diff';

interface DiffBlockProps {
  label: string;
  oldText: string;
  newText: string;
}

export function DiffBlock({ label, oldText, newText }: DiffBlockProps) {
  const changes = diffLines(oldText, newText);

  const allUnchanged = changes.every((c) => !c.added && !c.removed);
  if (allUnchanged) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </h4>
      <div className="rounded-md border border-border-subtle bg-elevated p-3 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
        {changes.map((part, i) => {
          if (part.added) {
            return (
              <div key={i} className="bg-success-bg text-success-text">
                {part.value
                  .split('\n')
                  .filter((line, j, arr) => j < arr.length - 1 || line !== '')
                  .map((line, j) => (
                    <div key={j}>+ {line}</div>
                  ))}
              </div>
            );
          }
          if (part.removed) {
            return (
              <div key={i} className="bg-error-bg text-error-text">
                {part.value
                  .split('\n')
                  .filter((line, j, arr) => j < arr.length - 1 || line !== '')
                  .map((line, j) => (
                    <div key={j}>- {line}</div>
                  ))}
              </div>
            );
          }
          return (
            <div key={i} className="text-foreground-muted">
              {part.value
                .split('\n')
                .filter((line, j, arr) => j < arr.length - 1 || line !== '')
                .map((line, j) => (
                  <div key={j}> {line}</div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
