using Clarive.Domain.Enums;
using Serilog;

namespace Clarive.Application.Audit.Services;

public static class AuditLoggerExtensions
{
    public static async Task SafeLogAsync(
        this IAuditLogger logger,
        Guid tenantId,
        Guid userId,
        string userName,
        AuditAction action,
        string entityType,
        Guid entityId,
        string entityTitle,
        string? details,
        CancellationToken ct
    )
    {
        try
        {
            await logger.LogAsync(
                tenantId,
                userId,
                userName,
                action,
                entityType,
                entityId,
                entityTitle,
                details,
                ct
            );
        }
        catch (Exception ex)
        {
            Log.Warning(
                ex,
                "Audit logging failed for {Action} on {EntityType} {EntityId}",
                action,
                entityType,
                entityId
            );
        }
    }
}
