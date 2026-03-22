using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

[DisallowConcurrentExecution]
public class AiSessionCleanupJob(
    ClariveDbContext db,
    ILogger<AiSessionCleanupJob> logger
) : IJob
{
    private static readonly TimeSpan AiSessionMaxAge = TimeSpan.FromHours(24);
    private static readonly TimeSpan PlaygroundRunMaxAge = TimeSpan.FromDays(30);

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

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
}
