using Microsoft.Extensions.Logging;
using Npgsql;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

[DisallowConcurrentExecution]
public class AuditLogCleanupJob(NpgsqlDataSource dataSource, ILogger<AuditLogCleanupJob> logger)
    : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        var now = DateTime.UtcNow;
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM audit_log_entries WHERE expires_at < @now";
        cmd.Parameters.AddWithValue("@now", now);
        var deleted = await cmd.ExecuteNonQueryAsync(ct);

        if (deleted > 0)
            logger.LogInformation("Cleaned up {Count} expired audit log entries", deleted);
    }
}
