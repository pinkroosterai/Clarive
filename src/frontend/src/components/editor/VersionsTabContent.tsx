import type { ReactNode } from 'react';

export interface VersionsTabContentProps {
  versionPanel: ReactNode;
}

export function VersionsTabContent({ versionPanel }: VersionsTabContentProps) {
  return <div className="space-y-4">{versionPanel}</div>;
}
