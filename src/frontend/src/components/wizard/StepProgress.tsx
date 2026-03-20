import { Check } from 'lucide-react';

interface StepProgressProps {
  currentStep: number; // 1-indexed
  totalSteps: number;
  labels: string[];
}

export function StepProgress({ currentStep, totalSteps, labels }: StepProgressProps) {
  return (
    <div className="flex items-center gap-0 w-full max-w-md">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;

        return (
          <div key={stepNum} className="flex items-center flex-1 last:flex-none">
            {/* Node + inline label */}
            <div className="flex items-center gap-1.5">
              <div
                className={`size-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 shrink-0 ${
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 glow-brand-sm'
                      : 'bg-elevated text-foreground-muted border border-border'
                }`}
              >
                {isCompleted ? <Check className="size-3" /> : stepNum}
              </div>
              <span
                className={`text-xs whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? 'text-foreground font-medium'
                    : isCompleted
                      ? 'text-primary'
                      : 'text-foreground-muted'
                }`}
              >
                {labels[i] ?? `Step ${stepNum}`}
              </span>
            </div>

            {/* Connector line */}
            {stepNum < totalSteps && (
              <div
                className={`h-0.5 flex-1 mx-2 transition-colors duration-300 ${
                  isCompleted ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
