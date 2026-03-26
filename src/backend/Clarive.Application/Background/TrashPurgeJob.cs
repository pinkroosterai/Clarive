using Clarive.Application.Audit.Contracts;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.Extensions.Logging;
using Quartz;

namespace Clarive.Application.Background;

[DisallowConcurrentExecution]
public class TrashPurgeJob(
    IEntryRepository entryRepo,
    IAuditLogger auditLogger,
    ILogger<TrashPurgeJob> logger
) : IJob
{
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(30);
    private const int BatchSize = 50;

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var cutoff = DateTime.UtcNow - MaxAge;
        var totalPurged = 0;

        while (true)
        {
            var entries = await entryRepo.GetExpiredTrashedEntriesAsync(cutoff, BatchSize, ct);

            if (entries.Count == 0)
                break;

            foreach (var entry in entries)
            {
                await entryRepo.DeleteAsync(entry.TenantId, entry.Id, ct);

                await auditLogger.LogAsync(
                    entry.TenantId,
                    Guid.Empty,
                    "System",
                    AuditAction.EntryDeleted,
                    "PromptEntry",
                    entry.Id,
                    entry.Title,
                    "Auto-purged after 30-day retention period",
                    ct
                );
            }

            totalPurged += entries.Count;
        }

        if (totalPurged > 0)
            logger.LogInformation(
                "Auto-purged {Count} trashed entries older than 30 days",
                totalPurged
            );
    }
}
