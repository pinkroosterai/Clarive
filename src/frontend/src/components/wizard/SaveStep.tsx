import { useQuery } from '@tanstack/react-query';
import { Loader2, Save, FolderInput, MessageSquare, Shield, BarChart3, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { scoreColor } from './scoreUtils';

import { FolderPickerDialog } from '@/components/library/FolderPickerDialog';
import { Button } from '@/components/ui/button';
import { findFolderName } from '@/lib/folderUtils';
import { folderService } from '@/services';
import type { PromptEntry, Evaluation } from '@/types';

interface SaveStepProps {
  draft: PromptEntry;
  mode: 'new' | 'enhance';
  evaluation?: Evaluation;
  onSave: (folderId: string | null) => void;
  onBack: () => void;
  isSaving: boolean;
}

export function SaveStep({ draft, mode, evaluation, onSave, onBack, isSaving }: SaveStepProps) {
  const [folderId, setFolderId] = useState<string | null>(draft.folderId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
    enabled: mode === 'new',
  });

  const folderName = findFolderName(folders, folderId);

  const averageScore = evaluation
    ? Object.values(evaluation.dimensions).reduce((sum, e) => sum + e.score, 0) /
      Object.keys(evaluation.dimensions).length
    : null;

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="bg-surface rounded-xl border border-border-subtle elevation-1 p-5 text-left space-y-3">
        <h4 className="font-semibold text-foreground">{draft.title}</h4>

        <div className="flex flex-wrap gap-3 text-xs text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            {draft.prompts.length} {draft.prompts.length === 1 ? 'prompt' : 'prompts'}
          </span>
          {draft.systemMessage && (
            <span className="flex items-center gap-1.5">
              <Shield className="size-3.5" />
              System message
            </span>
          )}
        </div>

        {averageScore !== null && (
          <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
            <BarChart3 className="size-3.5 text-primary" />
            <span className="text-xs font-medium">Quality: {averageScore.toFixed(1)}/10</span>
            <span className={`text-xs ${scoreColor(averageScore).text}`}>
              {scoreColor(averageScore).label}
            </span>
          </div>
        )}
      </div>

      <div className="text-center space-y-4">
        <p className="text-sm text-foreground-muted">
          {mode === 'new' ? 'Save as new draft entry?' : 'Apply enhanced version to current entry?'}
        </p>

        {mode === 'new' && (
          <div className="flex items-center justify-center gap-3 bg-elevated border-border rounded-lg px-4 py-3 mx-auto w-fit">
            <span className="text-sm text-foreground-muted">Folder: {folderName}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPickerOpen(true)}
            >
              <FolderInput className="size-3.5" />
              Change
            </Button>
            <FolderPickerDialog
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onSelect={(id) => {
                setFolderId(id);
                setPickerOpen(false);
              }}
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={onBack} disabled={isSaving}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button className="flex-1 gap-2 py-3" onClick={() => onSave(folderId)} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" />
                {mode === 'new' ? 'Save' : 'Apply'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
