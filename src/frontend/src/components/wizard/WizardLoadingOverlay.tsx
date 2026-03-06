import { useState, useEffect, useRef } from "react";

export type GeneratingOperation = "clarify" | "generate" | "refine" | "enhance";

interface WizardLoadingOverlayProps {
  operation: GeneratingOperation;
  currentStage?: string | null;
}

const MESSAGES: Record<GeneratingOperation, string[]> = {
  clarify: [
    "Understanding your request\u2026",
    "Preparing questions\u2026",
    "Almost ready\u2026",
  ],
  generate: [
    "Analyzing your description\u2026",
    "Crafting your prompt\u2026",
    "Evaluating quality\u2026",
    "Polishing the result\u2026",
  ],
  refine: [
    "Applying your feedback\u2026",
    "Refining prompt\u2026",
    "Re-evaluating quality\u2026",
    "Polishing the result\u2026",
  ],
  enhance: [
    "Analyzing existing entry\u2026",
    "Identifying improvements\u2026",
    "Generating enhancements\u2026",
    "Evaluating quality\u2026",
  ],
};

const STAGE_MESSAGES: Record<string, string> = {
  preparing: "Preparing your request…",
  clarifying: "Generating clarification questions…",
  generating: "Crafting your prompt…",
  evaluating: "Evaluating quality…",
  refining: "Refining your prompt…",
  bootstrapping: "Analyzing existing entry…",
};

const ROTATION_INTERVAL = 2500;

export function WizardLoadingOverlay({ operation, currentStage }: WizardLoadingOverlayProps) {
  const messages = MESSAGES[operation];
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [fading, setFading] = useState(false);
  const mountTime = useRef(Date.now());

  // When a real stage arrives, show it with a fade transition
  const stageMessage = currentStage ? STAGE_MESSAGES[currentStage] : null;

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Message rotation with fade — only when no real stage is active
  useEffect(() => {
    if (stageMessage || messages.length <= 1) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        setFading(false);
      }, 200);
    }, ROTATION_INTERVAL);
    return () => clearInterval(id);
  }, [messages, stageMessage]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 animate-step-forward">
      {/* Pulsing orb */}
      <div className="relative flex items-center justify-center">
        <div className="absolute size-16 rounded-full bg-primary/15 animate-ping [animation-duration:2s]" />
        <div className="absolute size-12 rounded-full bg-primary/10 animate-pulse" />
        <div className="relative size-8 rounded-full bg-primary/80 shadow-[0_0_20px_rgba(var(--primary),0.3)]" />
      </div>

      {/* Status message */}
      <p
        className={`text-sm font-medium text-foreground-secondary transition-opacity duration-200 ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      >
        {stageMessage ?? messages[messageIndex]}
      </p>

      {/* Elapsed time */}
      <span className="text-xs text-foreground-muted tabular-nums">
        {elapsed}s
      </span>
    </div>
  );
}
