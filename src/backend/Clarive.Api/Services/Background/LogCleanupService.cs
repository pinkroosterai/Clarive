using Npgsql;

namespace Clarive.Api.Services.Background;

/// <summary>
/// Periodically deletes old Serilog log entries from the database.
/// Runs every 24 hours, removing records older than 30 days.
/// </summary>
public class LogCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<LogCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(Interval, ct);
            await CleanupAsync(ct);
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var dataSource = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();

            var cutoff = DateTime.UtcNow - MaxAge;
            await using var cmd = dataSource.CreateCommand(
                "DELETE FROM logs WHERE timestamp < @cutoff");
            cmd.Parameters.AddWithValue("@cutoff", cutoff);

            await using var conn = await dataSource.OpenConnectionAsync(ct);
            cmd.Connection = conn;
            var deleted = await cmd.ExecuteNonQueryAsync(ct);

            if (deleted > 0)
                logger.LogInformation("Cleaned up {Count} old system log entries", deleted);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to clean up system log entries");
        }
    }
}
