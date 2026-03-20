using Clarive.Domain.Enums;

namespace Clarive.Domain.QueryResults;

public record AiUsageLogResponse(
    Guid Id,
    Guid TenantId,
    string? TenantName,
    Guid UserId,
    string? UserEmail,
    string ActionType,
    string Model,
    string Provider,
    string DisplayModel,
    long InputTokens,
    long OutputTokens,
    long TotalTokens,
    decimal? EstimatedInputCostUsd,
    decimal? EstimatedOutputCostUsd,
    long DurationMs,
    Guid? EntryId,
    DateTime CreatedAt
);

public record AiUsageStatsResponse(
    AiUsageTotals Totals,
    AiUsageAverages Averages,
    List<AiUsageBreakdownItem> ByModel,
    List<AiUsageBreakdownItem> ByTenant,
    List<AiUsageBreakdownItem> ByUser,
    List<AiUsageActionBreakdownItem> ByActionType
);

public record AiUsageTotals(
    long TotalRequests,
    long TotalInputTokens,
    long TotalOutputTokens,
    long TotalTokens,
    decimal TotalEstimatedInputCostUsd,
    decimal TotalEstimatedOutputCostUsd,
    decimal TotalEstimatedCostUsd
);

public record AiUsageAverages(
    double AvgInputTokensPerRequest,
    double AvgOutputTokensPerRequest,
    double AvgTotalTokensPerRequest
);

public record AiUsageBreakdownItem(
    string Name,
    long RequestCount,
    long InputTokens,
    long OutputTokens,
    long TotalTokens,
    double Percentage,
    decimal EstimatedInputCostUsd,
    decimal EstimatedOutputCostUsd,
    decimal EstimatedCostUsd
);

public record AiUsageActionBreakdownItem(
    string Name,
    string Provider,
    string Model,
    long RequestCount,
    double AvgInputTokens,
    double AvgOutputTokens,
    decimal AvgEstimatedInputCostUsd,
    decimal AvgEstimatedOutputCostUsd,
    double AvgDurationMs
);

public record AiUsageFilterRequest(
    List<Guid>? TenantIds = null,
    Guid? UserId = null,
    List<string>? Models = null,
    List<AiActionType>? ActionTypes = null,
    DateTime? DateFrom = null,
    DateTime? DateTo = null
);

public record AiUsageFilterOptionsResponse(
    List<AiUsageFilterModel> Models,
    List<string> ActionTypes,
    List<AiUsageFilterTenant> Tenants
);

public record AiUsageFilterModel(string Id, string DisplayName);

public record AiUsageFilterTenant(Guid Id, string Name);

public record AiUsagePagedResponse(
    List<AiUsageLogResponse> Items,
    int Page,
    int PageSize,
    long TotalCount
);
