using System.Data.Common;
using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfServiceConfigRepository(ClariveDbContext db) : IServiceConfigRepository
{
    public async Task<Dictionary<string, ServiceConfig>> GetAllAsync(CancellationToken ct = default)
    {
        try
        {
            return await db.ServiceConfigs.AsNoTracking().ToDictionaryAsync(c => c.Key, c => c, ct);
        }
        catch (DbException)
        {
            // Table may not exist yet if migration hasn't been applied
            return new Dictionary<string, ServiceConfig>();
        }
    }

    public async Task<ServiceConfig?> GetByKeyAsync(string key, CancellationToken ct = default)
    {
        return await db.ServiceConfigs.FindAsync([key], ct);
    }

    public async Task CreateOrUpdateAsync(ServiceConfig config, CancellationToken ct = default)
    {
        var existing = await db.ServiceConfigs.FindAsync([config.Key], ct);
        if (existing is not null)
        {
            existing.EncryptedValue = config.EncryptedValue;
            existing.IsEncrypted = config.IsEncrypted;
            existing.UpdatedAt = config.UpdatedAt;
            existing.UpdatedBy = config.UpdatedBy;
        }
        else
        {
            db.ServiceConfigs.Add(config);
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> DeleteByKeyAsync(string key, CancellationToken ct = default)
    {
        var existing = await db.ServiceConfigs.FindAsync([key], ct);
        if (existing is null)
            return false;

        db.ServiceConfigs.Remove(existing);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
