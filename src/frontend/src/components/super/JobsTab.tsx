import JobsGrid from '@/components/super/JobsGrid';

export default function JobsTab() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            Background Jobs
          </h3>
          <div className="flex-1 border-b border-border" />
        </div>
        <p className="text-xs text-foreground-muted">
          Monitor scheduled background jobs, view execution history, and control job scheduling.
        </p>
      </div>
      <JobsGrid />
    </section>
  );
}
