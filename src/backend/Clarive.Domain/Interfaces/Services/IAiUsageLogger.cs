using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;

namespace Clarive.Domain.Interfaces.Services;

public interface IAiUsageLogger
{
    Task<AiUsageCostResult> LogAsync(
        Guid tenantId,
        Guid userId,
        AiActionType actionType,
        string model,
        string provider,
        long inputTokens,
        long outputTokens,
        long durationMs,
        Guid? entryId = null,
        CancellationToken ct = default
    );
}
