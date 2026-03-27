import type React from 'react';

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-elevated rounded px-1.5 py-0.5 text-xs font-mono border border-border-subtle">
      {children}
    </kbd>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-elevated rounded px-1.5 py-0.5 text-xs font-mono border border-border-subtle">
      {children}
    </code>
  );
}

export function SectionIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="size-4 shrink-0 text-foreground-muted mr-2" />;
}

export interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  searchText: string;
  plainTextContent: string;
  searchAliases?: string[];
  relatedSections?: string[];
  content: React.ReactNode;
}

export interface SectionGroup {
  label: string;
  sections: Section[];
}
