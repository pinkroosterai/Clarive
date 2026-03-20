namespace Clarive.Application.SuperAdmin;

public interface IMaintenanceModeService
{
    bool IsEnabled { get; }
    Task SetEnabledAsync(bool enabled, string changedBy, CancellationToken ct = default);
}
