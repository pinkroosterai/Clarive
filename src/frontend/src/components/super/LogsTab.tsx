import SystemLogGrid from '@/components/super/SystemLogGrid';

export default function LogsTab() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            System Logs
          </h3>
          <div className="flex-1 border-b border-border" />
        </div>
        <p className="text-xs text-foreground-muted">
          Browse, filter, and inspect application log entries persisted to the database.
        </p>
      </div>
      <SystemLogGrid />
    </section>
  );
}
