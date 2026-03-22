using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

/// <summary>
/// Captures job execution lifecycle events and persists them to the job_execution_history table.
/// Registered as a singleton — uses IServiceScopeFactory for scoped repository access.
/// </summary>
public class JobExecutionHistoryListener(
    IServiceScopeFactory scopeFactory,
    ILogger<JobExecutionHistoryListener> logger
) : IJobListener
{
    private const string StartTicksKey = "_historyStartUtc";

    public string Name => "JobExecutionHistoryListener";

    public Task JobToBeExecuted(IJobExecutionContext context, CancellationToken ct = default)
    {
        context.MergedJobDataMap.Put(StartTicksKey, DateTime.UtcNow.Ticks);
        return Task.CompletedTask;
    }

    public async Task JobWasExecuted(
        IJobExecutionContext context,
        JobExecutionException? jobException,
        CancellationToken ct = default)
    {
        try
        {
            var startedAt = DateTime.UtcNow;
            if (context.MergedJobDataMap.ContainsKey(StartTicksKey))
            {
                var ticks = context.MergedJobDataMap.GetLong(StartTicksKey);
                startedAt = new DateTime(ticks, DateTimeKind.Utc);
            }

            var finishedAt = DateTime.UtcNow;

            var record = new JobExecutionHistory
            {
                Id = Guid.NewGuid(),
                JobName = context.JobDetail.Key.Name,
                JobGroup = context.JobDetail.Key.Group,
                TriggerName = context.Trigger.Key.Name,
                FireTimeUtc = context.FireTimeUtc.UtcDateTime,
                StartedAtUtc = startedAt,
                FinishedAtUtc = finishedAt,
                DurationMs = (long)(finishedAt - startedAt).TotalMilliseconds,
                Succeeded = jobException is null,
                ExceptionMessage = jobException?.InnerException?.Message ?? jobException?.Message,
                ExceptionStackTrace = jobException?.InnerException?.StackTrace ?? jobException?.StackTrace,
            };

            using var scope = scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IJobExecutionHistoryRepository>();
            await repo.AddAsync(record, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to persist job execution history for {JobName}", context.JobDetail.Key.Name);
        }
    }

    public async Task JobExecutionVetoed(IJobExecutionContext context, CancellationToken ct = default)
    {
        try
        {
            var record = new JobExecutionHistory
            {
                Id = Guid.NewGuid(),
                JobName = context.JobDetail.Key.Name,
                JobGroup = context.JobDetail.Key.Group,
                TriggerName = context.Trigger.Key.Name,
                FireTimeUtc = context.FireTimeUtc.UtcDateTime,
                StartedAtUtc = DateTime.UtcNow,
                FinishedAtUtc = DateTime.UtcNow,
                DurationMs = 0,
                Succeeded = false,
                ExceptionMessage = "Job execution was vetoed",
            };

            using var scope = scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IJobExecutionHistoryRepository>();
            await repo.AddAsync(record, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to persist vetoed job history for {JobName}", context.JobDetail.Key.Name);
        }
    }
}
