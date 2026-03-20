namespace Clarive.Core.Services;

public interface IMaintenanceModeService
{
    bool IsEnabled { get; }
    Task SetEnabledAsync(bool enabled, string changedBy, CancellationToken ct = default);
}
