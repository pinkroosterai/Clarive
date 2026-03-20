using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfAuditLogRepository(ClariveDbContext db) : IAuditLogRepository
{
    public async Task AddAsync(AuditLogEntry entry, CancellationToken ct = default)
    {
        db.AuditLogEntries.Add(entry);
        await db.SaveChangesAsync(ct);
    }

    public async Task<(List<AuditLogEntry> Entries, int Total)> GetPageAsync(
        Guid tenantId,
        int page,
        int pageSize,
        CancellationToken ct = default
    )
    {
        var query = db
            .AuditLogEntries.AsNoTracking()
            .Where(a => a.TenantId == tenantId)
            .OrderByDescending(a => a.Timestamp);

        var total = await query.CountAsync(ct);
        var entries = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return (entries, total);
    }

    public async Task<(List<AuditLogEntry> Entries, int Total)> GetByEntityIdAsync(
        Guid tenantId,
        Guid entityId,
        int page,
        int pageSize,
        CancellationToken ct = default
    )
    {
        var query = db
            .AuditLogEntries.AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.EntityId == entityId)
            .OrderByDescending(a => a.Timestamp);

        var total = await query.CountAsync(ct);
        var entries = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return (entries, total);
    }
}
