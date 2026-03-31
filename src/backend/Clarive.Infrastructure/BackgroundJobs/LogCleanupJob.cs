using Microsoft.Extensions.Logging;
using Npgsql;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

[DisallowConcurrentExecution]
public class LogCleanupJob(
    NpgsqlDataSource dataSource,
    ILogger<LogCleanupJob> logger
) : IJob
{
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(7);

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        var cutoff = DateTime.UtcNow - MaxAge;
        await using var conn = await dataSource.OpenConnectionAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM logs WHERE timestamp < @cutoff";
        cmd.Parameters.AddWithValue("@cutoff", cutoff);
        var deleted = await cmd.ExecuteNonQueryAsync(ct);

        if (deleted > 0)
            logger.LogInformation("Cleaned up {Count} old system log entries", deleted);
    }
}
