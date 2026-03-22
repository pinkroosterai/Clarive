using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfAccountPurgeRepository(ClariveDbContext db) : IAccountPurgeRepository
{
    public async Task<List<Tenant>> GetExpiredTenantsAsync(int batchSize, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await db
            .Tenants.Include(t => t.Users)
            .Where(t => t.DeleteScheduledAt != null && t.DeleteScheduledAt <= now)
            .Take(batchSize)
            .ToListAsync(ct);
    }

    public async Task RemoveTenantsAsync(List<Tenant> tenants, CancellationToken ct = default)
    {
        db.Tenants.RemoveRange(tenants);
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<User>> GetExpiredUsersAsync(int batchSize, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await db
            .Users.Where(u => u.DeleteScheduledAt != null && u.DeleteScheduledAt <= now)
            .Take(batchSize)
            .ToListAsync(ct);
    }

    public async Task RemoveUsersAsync(List<User> users, CancellationToken ct = default)
    {
        db.Users.RemoveRange(users);
        await db.SaveChangesAsync(ct);
    }
}
