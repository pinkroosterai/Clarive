import { GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';

export interface VersionsTabContentProps {
  versionPanel: ReactNode;
}

export function VersionsTabContent({ versionPanel }: VersionsTabContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Versions</h3>
      </div>
      {versionPanel}
    </div>
  );
}
