using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfApiKeyRepository(ClariveDbContext db) : IApiKeyRepository
{
    public async Task<List<ApiKey>> GetByTenantAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await db.ApiKeys.AsNoTracking().Where(k => k.TenantId == tenantId).ToListAsync(ct);
    }

    public async Task<ApiKey?> GetByIdAsync(Guid tenantId, Guid keyId, CancellationToken ct = default)
    {
        return await db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId && k.TenantId == tenantId, ct);
    }

    public async Task<ApiKey?> GetByHashAsync(string keyHash, CancellationToken ct = default)
    {
        return await db.ApiKeys.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(k => k.KeyHash == keyHash, ct);
    }

    public async Task<ApiKey> CreateAsync(ApiKey key, CancellationToken ct = default)
    {
        db.ApiKeys.Add(key);
        await db.SaveChangesAsync(ct);
        return key;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid keyId, CancellationToken ct = default)
    {
        var key = await db.ApiKeys.FirstOrDefaultAsync(k => k.Id == keyId && k.TenantId == tenantId, ct);
        if (key is null) return false;
        db.ApiKeys.Remove(key);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task TouchLastUsedAsync(Guid keyId, CancellationToken ct = default)
    {
        await db.ApiKeys.IgnoreQueryFilters()
            .Where(k => k.Id == keyId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(k => k.LastUsedAt, DateTime.UtcNow)
                .SetProperty(k => k.UsageCount, k => k.UsageCount + 1), ct);
    }
}
