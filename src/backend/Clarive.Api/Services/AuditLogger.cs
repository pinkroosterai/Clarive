using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class AuditLogger(IAuditLogRepository auditRepo) : IAuditLogger
{
    public async Task LogAsync(
        Guid tenantId,
        Guid userId,
        string userName,
        AuditAction action,
        string entityType,
        Guid entityId,
        string entityTitle,
        string? details = null,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        await auditRepo.AddAsync(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            EntityTitle = entityTitle,
            UserId = userId,
            UserName = userName,
            Timestamp = now,
            Details = details,
            ExpiresAt = now.AddDays(30)
        }, ct);
    }
}
