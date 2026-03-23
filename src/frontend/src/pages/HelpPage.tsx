import Fuse from 'fuse.js';
import type { FuseResultMatch } from 'fuse.js';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  FlaskConical,
  Rocket,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { allSections, type Section, SectionIcon, sectionGroups } from './helpPageData';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

// ── Highlight component for fuzzy search matches ──

function HighlightMatch({
  text,
  indices,
}: {
  text: string;
  indices: readonly [number, number][];
}) {
  if (!indices || indices.length === 0) return <>{text}</>;

  const result: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      result.push(text.slice(lastEnd, start));
    }
    result.push(
      <mark
        key={start}
        className="bg-yellow-200/60 dark:bg-yellow-500/30 rounded-sm px-0.5"
      >
        {text.slice(start, end + 1)}
      </mark>
    );
    lastEnd = end + 1;
  }

  if (lastEnd < text.length) {
    result.push(text.slice(lastEnd));
  }

  return <>{result}</>;
}

export default function HelpPage() {
  const location = useLocation();
  const isSuperUser = useAuthStore((s) => s.currentUser?.isSuperUser);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const preSearchOpenRef = useRef<string[] | null>(null);

  // Filter out super-admin section for non-super users
  const visibleGroups = useMemo(
    () =>
      isSuperUser
        ? sectionGroups
        : sectionGroups.map((group) => ({
            ...group,
            sections: group.sections.filter((s) => s.id !== 'super-admin'),
          })),
    [isSuperUser]
  );

  const visibleSectionsFlat = useMemo(
    () => visibleGroups.flatMap((g) => g.sections),
    [visibleGroups]
  );

  // Fuse.js instance
  const fuse = useMemo(
    () =>
      new Fuse(visibleSectionsFlat, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'searchAliases', weight: 1.5 },
          { name: 'searchText', weight: 1.5 },
          { name: 'plainTextContent', weight: 1 },
        ],
        threshold: 0.3,
        includeMatches: true,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [visibleSectionsFlat]
  );

  useEffect(() => {
    document.title = 'Clarive — Help';
  }, []);

  // Hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && allSections.some((s) => s.id === hash)) {
      setOpenSections((prev) => (prev.includes(hash) ? prev : [...prev, hash]));
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [location.hash]);

  // Fuzzy search with match data
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return null;
    return fuse.search(q);
  }, [searchQuery, fuse]);

  // Build a map of section ID → title match indices for highlighting
  const titleMatchMap = useMemo(() => {
    if (!searchResults) return new Map<string, readonly [number, number][]>();
    const map = new Map<string, readonly [number, number][]>();
    for (const result of searchResults) {
      const titleMatch = result.matches?.find((m: FuseResultMatch) => m.key === 'title');
      if (titleMatch?.indices) {
        map.set(result.item.id, titleMatch.indices as readonly [number, number][]);
      }
    }
    return map;
  }, [searchResults]);

  // Filter groups using Fuse results
  const filteredGroups = useMemo(() => {
    if (!searchResults) return visibleGroups;
    const matchedIds = new Set(searchResults.map((r) => r.item.id));
    return visibleGroups
      .map((group) => ({
        ...group,
        sections: group.sections.filter((s) => matchedIds.has(s.id)),
      }))
      .filter((group) => group.sections.length > 0);
  }, [searchResults, visibleGroups]);

  const visibleSectionIds = useMemo(
    () => filteredGroups.flatMap((g) => g.sections.map((s) => s.id)),
    [filteredGroups]
  );

  // Auto-expand matched sections when searching, restore on clear
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      if (preSearchOpenRef.current === null) {
        preSearchOpenRef.current = openSections;
      }
      setOpenSections(searchResults.map((r) => r.item.id));
    } else if (searchResults === null && preSearchOpenRef.current !== null) {
      setOpenSections(preSearchOpenRef.current);
      preSearchOpenRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to search changes, not openSections
  }, [searchResults]);

  // IntersectionObserver for active section highlighting
  useEffect(() => {
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { threshold: 0.1, rootMargin: '-80px 0px -60% 0px' }
    );
    observerRef.current = observer;

    for (const id of visibleSectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [visibleSectionIds]);

  const handleTocClick = useCallback((sectionId: string) => {
    setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  const renderRelatedSections = useCallback(
    (section: Section) => {
      if (!section.relatedSections || section.relatedSections.length === 0) return null;
      return (
        <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground-muted">Related:</span>
          {section.relatedSections.map((relId) => {
            const rel = allSections.find((s) => s.id === relId);
            if (!rel) return null;
            return (
              <button
                key={relId}
                type="button"
                onClick={() => handleTocClick(relId)}
                className="text-xs text-primary hover:underline"
              >
                {rel.title}
              </button>
            );
          })}
        </div>
      );
    },
    [handleTocClick]
  );

  return (
    <div className="flex gap-8 max-w-6xl mx-auto p-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-3">
          <CircleHelp className="size-7 text-foreground-muted" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Help</h1>
            <p className="text-sm text-foreground-muted">
              Everything you need to know about using Clarive.
            </p>
          </div>
        </div>

        {/* Quick Start cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Rocket,
              title: 'Create Your First Prompt',
              description: 'Start from scratch or let AI generate one for you.',
              section: 'getting-started',
            },
            {
              icon: FlaskConical,
              title: 'Test & Compare Models',
              description: 'Run prompts against AI models and compare results.',
              section: 'playground',
            },
            {
              icon: Users,
              title: 'Share with Your Team',
              description: 'Invite members and collaborate in shared workspaces.',
              section: 'workspaces',
            },
          ].map((card) => (
            <button
              key={card.section}
              type="button"
              onClick={() => handleTocClick(card.section)}
              className="text-left p-4 rounded-lg border border-border-subtle bg-surface hover:bg-elevated transition-colors group"
            >
              <card.icon className="size-5 text-primary mb-2" />
              <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {card.title}
              </h3>
              <p className="text-xs text-foreground-muted mt-1">{card.description}</p>
            </button>
          ))}
        </div>

        {/* Search + Expand/Collapse */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted" />
            <Input
              placeholder="Search help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenSections(visibleSectionIds)}
            className="shrink-0 text-xs"
          >
            <ChevronsUpDown className="size-3.5 mr-1" />
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenSections([])}
            className="shrink-0 text-xs"
          >
            <ChevronsDownUp className="size-3.5 mr-1" />
            Collapse All
          </Button>
        </div>

        {/* Accordion with grouped sections */}
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-foreground-muted">
            <Search className="size-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="w-full"
          >
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider pt-4 pb-1">
                  {group.label}
                </p>
                {group.sections.map((section) => (
                  <AccordionItem key={section.id} value={section.id} id={section.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex items-center">
                        <SectionIcon icon={section.icon} />
                        {titleMatchMap.has(section.id) ? (
                          <HighlightMatch
                            text={section.title}
                            indices={titleMatchMap.get(section.id)!}
                          />
                        ) : (
                          section.title
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground-muted">
                      {section.content}
                      {renderRelatedSections(section)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </div>
            ))}
          </Accordion>
        )}
      </div>

      {/* Sidebar TOC — desktop only, right side */}
      <nav className="hidden xl:block w-56 shrink-0">
        <div className="sticky top-20 space-y-3">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider pb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleTocClick(section.id)}
                    className={cn(
                      'flex items-center gap-2 text-sm w-full text-left py-1 px-2 rounded-md transition-colors',
                      activeSection === section.id
                        ? 'text-foreground font-medium bg-primary/5 border-l-2 border-primary'
                        : 'text-foreground-muted hover:text-foreground hover:bg-elevated'
                    )}
                  >
                    <section.icon className="size-3.5 shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
