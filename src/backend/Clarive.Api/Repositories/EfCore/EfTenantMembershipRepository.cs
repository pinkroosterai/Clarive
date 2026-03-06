using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfTenantMembershipRepository(ClariveDbContext db) : ITenantMembershipRepository
{
    public async Task<List<TenantMembership>> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
    {
        return await db.TenantMemberships.IgnoreQueryFilters()
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.IsPersonal)
            .ThenBy(m => m.JoinedAt)
            .ToListAsync(ct);
    }

    public async Task<TenantMembership?> GetAsync(Guid userId, Guid tenantId, CancellationToken ct = default)
    {
        return await db.TenantMemberships.IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId, ct);
    }

    public async Task<List<TenantMembership>> GetByTenantIdAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await db.TenantMemberships.IgnoreQueryFilters()
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId)
            .OrderBy(m => m.JoinedAt)
            .ToListAsync(ct);
    }

    public async Task<TenantMembership> CreateAsync(TenantMembership membership, CancellationToken ct = default)
    {
        db.TenantMemberships.Add(membership);
        await db.SaveChangesAsync(ct);
        return membership;
    }

    public async Task UpdateAsync(TenantMembership membership, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid userId, Guid tenantId, CancellationToken ct = default)
    {
        var membership = await db.TenantMemberships.IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.UserId == userId && m.TenantId == tenantId, ct);

        if (membership is not null)
        {
            db.TenantMemberships.Remove(membership);
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task<Dictionary<Guid, int>> CountMembersByTenantIdsAsync(IEnumerable<Guid> tenantIds, CancellationToken ct = default)
    {
        var idList = tenantIds.ToList();
        if (idList.Count == 0) return [];

        return await db.TenantMemberships.IgnoreQueryFilters()
            .Where(m => idList.Contains(m.TenantId))
            .GroupBy(m => m.TenantId)
            .ToDictionaryAsync(g => g.Key, g => g.Count(), ct);
    }

    public async Task<int> CountAdminsAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await db.TenantMemberships.IgnoreQueryFilters()
            .CountAsync(m => m.TenantId == tenantId && m.Role == UserRole.Admin, ct);
    }
}
