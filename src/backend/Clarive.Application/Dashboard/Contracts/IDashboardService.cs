namespace Clarive.Application.Dashboard.Contracts;

public interface IDashboardService
{
    Task<DashboardStatsResponse> GetStatsAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct = default
    );
}
