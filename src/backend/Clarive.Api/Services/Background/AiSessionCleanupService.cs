using Clarive.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Services.Background;

/// <summary>
/// Periodically deletes expired AI sessions from the database.
/// Runs every hour, removes sessions older than 24 hours.
/// </summary>
public class AiSessionCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<AiSessionCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);

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
            var cutoff = DateTime.UtcNow - MaxAge;

            var deleted = await db.AiSessions
                .Where(s => s.CreatedAt < cutoff)
                .ExecuteDeleteAsync(ct);

            if (deleted > 0)
                logger.LogInformation("Cleaned up {Count} expired AI sessions", deleted);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to clean up expired AI sessions");
        }
    }
}
