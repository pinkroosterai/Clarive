using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Application.SuperAdmin;

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
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();

        var config = await db.SystemConfigs.FirstOrDefaultAsync(c => c.Id == 1, ct);
        if (config is null)
            return;

        config.MaintenanceEnabled = enabled;
        config.MaintenanceSince = enabled ? DateTime.UtcNow : null;
        config.MaintenanceBy = enabled ? changedBy : null;
        await db.SaveChangesAsync(ct);

        _enabled = enabled;
    }

    /// <summary>
    /// Called by MaintenanceModeSyncService to refresh the in-memory cache from DB.
    /// </summary>
    internal void SyncFromDb(bool enabled) => _enabled = enabled;
}
