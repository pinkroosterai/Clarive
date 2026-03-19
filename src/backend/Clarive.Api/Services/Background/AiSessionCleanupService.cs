using Clarive.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Services.Background;

/// <summary>
/// Periodically deletes expired AI sessions and old playground runs from the database.
/// Runs every hour: removes AI sessions older than 24 hours and playground runs older than 30 days.
/// </summary>
public class AiSessionCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<AiSessionCleanupService> logger
) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private static readonly TimeSpan AiSessionMaxAge = TimeSpan.FromHours(24);
    private static readonly TimeSpan PlaygroundRunMaxAge = TimeSpan.FromDays(30);

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
            var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();

            var aiCutoff = DateTime.UtcNow - AiSessionMaxAge;
            var deletedSessions = await db
                .AiSessions.Where(s => s.CreatedAt < aiCutoff)
                .ExecuteDeleteAsync(ct);

            if (deletedSessions > 0)
                logger.LogInformation("Cleaned up {Count} expired AI sessions", deletedSessions);

            var runCutoff = DateTime.UtcNow - PlaygroundRunMaxAge;
            var deletedRuns = await db
                .PlaygroundRuns.Where(r => r.CreatedAt < runCutoff)
                .ExecuteDeleteAsync(ct);

            if (deletedRuns > 0)
                logger.LogInformation("Cleaned up {Count} expired playground runs", deletedRuns);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to clean up expired sessions/runs");
        }
    }
}
