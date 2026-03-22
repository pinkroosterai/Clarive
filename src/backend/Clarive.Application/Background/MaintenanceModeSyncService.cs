using Clarive.Application.SuperAdmin.Services;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.Background;

public class MaintenanceModeSyncService(
    IServiceScopeFactory scopeFactory,
    MaintenanceModeService maintenanceMode,
    ILogger<MaintenanceModeSyncService> logger
) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await SyncAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error syncing maintenance mode from database");
            }

            await Task.Delay(PollInterval, ct);
        }
    }

    private async Task SyncAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<ISystemConfigRepository>();
        var config = await repo.GetAsync(ct);

        if (config is not null)
            maintenanceMode.SyncFromDb(config.MaintenanceEnabled);
    }
}
