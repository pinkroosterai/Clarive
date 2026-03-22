using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

[DisallowConcurrentExecution]
public class AiUsageCleanupJob(
    ClariveDbContext db,
    ILogger<AiUsageCleanupJob> logger
) : IJob
{
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(90);

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        var cutoff = DateTime.UtcNow - MaxAge;
        var deleted = await db
            .AiUsageLogs.Where(l => l.CreatedAt < cutoff)
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            logger.LogInformation("Cleaned up {Count} old AI usage logs", deleted);
    }
}
