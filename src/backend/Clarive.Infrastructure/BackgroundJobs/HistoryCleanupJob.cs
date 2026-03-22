using Clarive.Domain.Interfaces.Repositories;
using Microsoft.Extensions.Logging;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

[DisallowConcurrentExecution]
public class HistoryCleanupJob(
    IJobExecutionHistoryRepository repo,
    ILogger<HistoryCleanupJob> logger
) : IJob
{
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(90);

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        var cutoff = DateTime.UtcNow - MaxAge;
        var deleted = await repo.PurgeOlderThanAsync(cutoff, ct);

        if (deleted > 0)
            logger.LogInformation("Cleaned up {Count} old job execution history records", deleted);
    }
}
