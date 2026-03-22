using Clarive.Application.SuperAdmin.Services;
using Clarive.Domain.Interfaces.Repositories;
using Quartz;

namespace Clarive.Application.Background;

[DisallowConcurrentExecution]
public class MaintenanceSyncJob(
    ISystemConfigRepository configRepo,
    MaintenanceModeService maintenanceMode,
    ILogger<MaintenanceSyncJob> logger
) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        try
        {
            var config = await configRepo.GetAsync(ct);

            if (config is not null)
                maintenanceMode.SyncFromDb(config.MaintenanceEnabled);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Error syncing maintenance mode from database");
        }
    }
}
