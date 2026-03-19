using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfTenantRepository(ClariveDbContext db) : ITenantRepository
{
    public async Task<Tenant> CreateAsync(Tenant tenant, CancellationToken ct = default)
    {
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(ct);
        return tenant;
    }

    public async Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public async Task<Dictionary<Guid, Tenant>> GetByIdsAsync(
        IEnumerable<Guid> ids,
        CancellationToken ct = default
    )
    {
        var idList = ids.ToList();
        if (idList.Count == 0)
            return [];

        var tenants = await db
            .Tenants.AsNoTracking()
            .Where(t => idList.Contains(t.Id))
            .ToListAsync(ct);

        return tenants.ToDictionary(t => t.Id);
    }

    public async Task UpdateAsync(Tenant tenant, CancellationToken ct = default)
    {
        db.Tenants.Update(tenant);
        await db.SaveChangesAsync(ct);
    }
}
