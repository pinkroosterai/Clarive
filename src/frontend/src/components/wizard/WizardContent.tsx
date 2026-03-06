import { X, AlertTriangle } from 'lucide-react';

import { ClarifyStep } from './ClarifyStep';
import { DescribeStep } from './DescribeStep';
import { ReviewStep } from './ReviewStep';
import { SaveStep } from './SaveStep';
import { StepProgress } from './StepProgress';
import { useWizardOrchestration } from './useWizardOrchestration';
import { WizardLoadingOverlay } from './WizardLoadingOverlay';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { PromptEntry } from '@/types';

interface WizardContentProps {
  mode: 'new' | 'enhance';
  existingEntry?: PromptEntry;
  onClose: () => void;
}

export function WizardContent({ mode, existingEntry, onClose }: WizardContentProps) {
  const {
    step,
    setStep,
    totalSteps,
    displayStep,
    stepLabels,
    direction,
    stepHint,
    draft,
    questions,
    enhancements,
    evaluation,
    scoreHistory,
    isGenerating,
    generatingOperation,
    currentStage,
    bootstrapState,
    preGenQuestions,
    preGenEnhancements,
    confirmDiscardOpen,
    setConfirmDiscardOpen,
    handleDescribe,
    handleClarifyAndGenerate,
    handleSkipClarify,
    handleRefine,
    requestClose,
    confirmDiscard,
    runBootstrap,
    saveMutation,
  } = useWizardOrchestration(mode, existingEntry, onClose);

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight">AI Wizard</h1>
            <StepProgress currentStep={displayStep} totalSteps={totalSteps} labels={stepLabels} />
            <span className="text-sm text-foreground-muted hidden lg:inline">{stepHint}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === 1 && !isGenerating && (
            <div
              key="step-1"
              className={`max-w-2xl mx-auto space-y-6 p-6 ${direction === 'forward' ? 'animate-step-forward' : 'animate-step-backward'}`}
            >
              <DescribeStep onGenerate={handleDescribe} isGenerating={isGenerating} />
            </div>
          )}

          {step === 1 && isGenerating && generatingOperation && (
            <WizardLoadingOverlay operation={generatingOperation} currentStage={currentStage} />
          )}

          {step === 2 && !isGenerating && (
            <div
              key="step-2"
              className={`max-w-2xl mx-auto space-y-6 p-6 ${direction === 'forward' ? 'animate-step-forward' : 'animate-step-backward'}`}
            >
              <ClarifyStep
                questions={preGenQuestions}
                enhancements={preGenEnhancements}
                onContinue={handleClarifyAndGenerate}
                onSkip={handleSkipClarify}
                isLoading={isGenerating}
              />
            </div>
          )}

          {step === 2 && isGenerating && generatingOperation && (
            <WizardLoadingOverlay operation={generatingOperation} currentStage={currentStage} />
          )}

          {step === 3 && bootstrapState === 'loading' && (
            <WizardLoadingOverlay operation="enhance" currentStage={currentStage} />
          )}

          {step === 3 && bootstrapState === 'error' && (
            <div
              key="step-3-error"
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <AlertTriangle className="size-8 text-destructive" />
              <p className="text-foreground-secondary">Failed to initialize enhancement.</p>
              <Button onClick={runBootstrap}>Try Again</Button>
            </div>
          )}

          {step === 3 && bootstrapState === 'ready' && draft && !isGenerating && (
            <div
              key="step-3"
              className={`h-full p-6 ${direction === 'forward' ? 'animate-step-forward' : 'animate-step-backward'}`}
            >
              <ReviewStep
                draft={draft}
                questions={questions}
                enhancements={enhancements}
                evaluation={evaluation}
                scoreHistory={scoreHistory}
                onRefine={handleRefine}
                onAccept={() => setStep(4)}
                isRefining={isGenerating}
              />
            </div>
          )}

          {step === 3 &&
            bootstrapState === 'ready' &&
            draft &&
            isGenerating &&
            generatingOperation && (
              <WizardLoadingOverlay operation={generatingOperation} currentStage={currentStage} />
            )}

          {step === 4 && draft && (
            <div
              key="step-4"
              className={`max-w-2xl mx-auto space-y-6 p-6 ${direction === 'forward' ? 'animate-step-forward' : 'animate-step-backward'}`}
            >
              <SaveStep
                draft={draft}
                mode={mode}
                onSave={(folderId) => saveMutation.mutate(folderId)}
                isSaving={saveMutation.isPending}
              />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose the generated draft if you close the wizard now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
