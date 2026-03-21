import { ChevronsDownUp, ChevronsUpDown, CircleHelp, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { allSections, SectionIcon, sectionGroups } from './helpPageData';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function HelpPage() {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sectionGroups;
    return sectionGroups
      .map((group) => ({
        ...group,
        sections: group.sections.filter(
          (s) => s.title.toLowerCase().includes(q) || s.searchText.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.sections.length > 0);
  }, [searchQuery]);

  const visibleSectionIds = useMemo(
    () => filteredGroups.flatMap((g) => g.sections.map((s) => s.id)),
    [filteredGroups]
  );

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
                        {section.title}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground-muted">
                      {section.content}
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
