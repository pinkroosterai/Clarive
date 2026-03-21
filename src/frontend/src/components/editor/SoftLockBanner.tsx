import { AlertTriangle } from 'lucide-react';

import { UserAvatar } from '@/components/common/UserAvatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { PresenceUser } from '@/types';

interface SoftLockBannerProps {
  activeEditor: PresenceUser;
  onOverride: () => void;
}

export function SoftLockBanner({ activeEditor, onOverride }: SoftLockBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-warning-border bg-warning-bg px-4 py-2.5 text-sm">
      <AlertTriangle className="size-4 text-warning-text shrink-0" />
      <span className="flex items-center gap-2 flex-1 text-warning-text">
        <UserAvatar
          name={activeEditor.name}
          avatarUrl={activeEditor.avatarUrl}
          className="h-5 w-5"
          fallbackClassName="text-[8px]"
        />
        <span className="font-medium">{activeEditor.name}</span> is currently editing this prompt
      </span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0">
            Edit anyway
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit alongside {activeEditor.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Another user is actively editing this prompt. Editing simultaneously may cause conflicts
              when saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onOverride}>Edit anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
