using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IAuditLogRepository
{
    Task AddAsync(AuditLogEntry entry, CancellationToken ct = default);
    Task<(List<AuditLogEntry> Entries, int Total)> GetPageAsync(Guid tenantId, int page, int pageSize, CancellationToken ct = default);
}
