using Clarive.Domain.Enums;

namespace Clarive.Api.Services.Interfaces;

public interface IAuditLogger
{
    Task LogAsync(
        Guid tenantId,
        Guid userId,
        string userName,
        AuditAction action,
        string entityType,
        Guid entityId,
        string entityTitle,
        string? details = null,
        CancellationToken ct = default
    );
}
