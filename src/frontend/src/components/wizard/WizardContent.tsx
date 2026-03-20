import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';

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

const stepVariants = {
  enter: (dir: 'forward' | 'backward') => ({
    x: dir === 'forward' ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 'forward' | 'backward') => ({
    x: dir === 'forward' ? -40 : 40,
    opacity: 0,
  }),
};

const stepTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const fadeTransition = {
  duration: 0.25,
  ease: [0.16, 1, 0.3, 1] as const,
};

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
    progressLog,
    bootstrapState,
    confirmDiscardOpen,
    setConfirmDiscardOpen,
    handleDescribe,
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
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-2.5">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap">AI Wizard</h1>
            <StepProgress currentStep={displayStep} totalSteps={totalSteps} labels={stepLabels} />
            <span className="text-xs text-foreground-muted hidden lg:inline">{stepHint}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && !isGenerating && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="max-w-2xl mx-auto space-y-6 p-6"
              >
                <DescribeStep onGenerate={handleDescribe} isGenerating={isGenerating} />
              </motion.div>
            )}

            {step === 1 && isGenerating && generatingOperation && (
              <motion.div
                key="step-1-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="h-full"
              >
                <WizardLoadingOverlay
                  operation={generatingOperation}
                  currentStage={currentStage}
                  progressLog={progressLog}
                />
              </motion.div>
            )}

            {step === 2 && bootstrapState === 'loading' && (
              <motion.div
                key="step-2-bootstrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="h-full"
              >
                <WizardLoadingOverlay
                  operation="enhance"
                  currentStage={currentStage}
                  progressLog={progressLog}
                />
              </motion.div>
            )}

            {step === 2 && bootstrapState === 'error' && (
              <motion.div
                key="step-2-error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="flex flex-col items-center justify-center h-full gap-4"
              >
                <AlertTriangle className="size-8 text-destructive" />
                <p className="text-foreground-muted">Failed to initialize enhancement.</p>
                <Button onClick={runBootstrap}>Try Again</Button>
              </motion.div>
            )}

            {step === 2 && bootstrapState === 'ready' && draft && !isGenerating && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="h-full p-6"
              >
                <ReviewStep
                  draft={draft}
                  questions={questions}
                  enhancements={enhancements}
                  evaluation={evaluation}
                  scoreHistory={scoreHistory}
                  onRefine={handleRefine}
                  onAccept={() => setStep(3)}
                  isRefining={isGenerating}
                />
              </motion.div>
            )}

            {step === 2 &&
              bootstrapState === 'ready' &&
              draft &&
              isGenerating &&
              generatingOperation && (
                <motion.div
                  key="step-2-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="h-full"
                >
                  <WizardLoadingOverlay
                    operation={generatingOperation}
                    currentStage={currentStage}
                    progressLog={progressLog}
                  />
                </motion.div>
              )}

            {step === 3 && draft && (
              <motion.div
                key="step-3"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
                className="max-w-2xl mx-auto space-y-6 p-6"
              >
                <SaveStep
                  draft={draft}
                  mode={mode}
                  evaluation={evaluation}
                  onSave={(folderId) => saveMutation.mutate(folderId)}
                  onBack={() => setStep(2)}
                  isSaving={saveMutation.isPending}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
