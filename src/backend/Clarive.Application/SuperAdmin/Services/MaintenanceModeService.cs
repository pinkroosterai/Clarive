using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Application.SuperAdmin.Services;

public class MaintenanceModeService(IServiceScopeFactory scopeFactory) : IMaintenanceModeService
{
    private volatile bool _enabled;

    public bool IsEnabled => _enabled;

    public async Task SetEnabledAsync(
        bool enabled,
        string changedBy,
        CancellationToken ct = default
    )
    {
        using var scope = scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<ISystemConfigRepository>();

        var config = await repo.GetAsync(ct);
        if (config is null)
            return;

        config.MaintenanceEnabled = enabled;
        config.MaintenanceSince = enabled ? DateTime.UtcNow : null;
        config.MaintenanceBy = enabled ? changedBy : null;
        await repo.SaveAsync(config, ct);

        _enabled = enabled;
    }

    /// <summary>
    /// Called by MaintenanceModeSyncService to refresh the in-memory cache from DB.
    /// </summary>
    internal void SyncFromDb(bool enabled) => _enabled = enabled;
}
