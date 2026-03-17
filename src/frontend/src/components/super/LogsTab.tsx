import SystemLogGrid from '@/components/super/SystemLogGrid';

export default function LogsTab() {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
          System Logs
        </h3>
        <p className="text-xs text-foreground-muted mt-1">
          Browse, filter, and inspect application log entries persisted to the database.
        </p>
      </div>
      <SystemLogGrid />
    </section>
  );
}
