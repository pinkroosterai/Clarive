using Clarive.Api.Models.Enums;

namespace Clarive.Api.Services.Interfaces;

public interface IAiUsageLogger
{
    Task LogAsync(
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
