using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IAuditLogRepository
{
    Task AddAsync(AuditLogEntry entry, CancellationToken ct = default);
    Task<(List<AuditLogEntry> Entries, int Total)> GetPageAsync(
        Guid tenantId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );
    Task<(List<AuditLogEntry> Entries, int Total)> GetByEntityIdAsync(
        Guid tenantId,
        Guid entityId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );
}
