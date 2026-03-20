using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.BackgroundJobs;

/// <summary>
/// Periodically deletes old AI usage logs from the database.
/// Runs every 24 hours, removing records older than 90 days.
/// </summary>
public class AiUsageCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<AiUsageCleanupService> logger
) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(90);

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
            var deleted = await db
                .AiUsageLogs.Where(l => l.CreatedAt < cutoff)
                .ExecuteDeleteAsync(ct);

            if (deleted > 0)
                logger.LogInformation("Cleaned up {Count} old AI usage logs", deleted);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to clean up AI usage logs");
        }
    }
}
