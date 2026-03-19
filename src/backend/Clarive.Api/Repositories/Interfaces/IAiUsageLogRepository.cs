using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;

namespace Clarive.Api.Repositories.Interfaces;

public interface IAiUsageLogRepository
{
    Task<AiUsageLog> AddAsync(AiUsageLog log, CancellationToken ct = default);
    Task<AiUsagePagedResponse> GetFilteredAsync(
        AiUsageFilterRequest filter,
        int page,
        int pageSize,
        string? sortBy = null,
        bool sortDesc = true,
        CancellationToken ct = default
    );
    Task<AiUsageStatsResponse> GetStatsAsync(
        AiUsageFilterRequest filter,
        CancellationToken ct = default
    );
    Task<AiUsageFilterOptionsResponse> GetFilterOptionsAsync(
        DateTime? dateFrom = null,
        DateTime? dateTo = null,
        CancellationToken ct = default
    );
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct = default);
}
