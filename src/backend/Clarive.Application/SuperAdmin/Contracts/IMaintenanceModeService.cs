namespace Clarive.Application.SuperAdmin.Contracts;

public interface IMaintenanceModeService
{
    bool IsEnabled { get; }
    Task SetEnabledAsync(bool enabled, string changedBy, CancellationToken ct = default);
}
