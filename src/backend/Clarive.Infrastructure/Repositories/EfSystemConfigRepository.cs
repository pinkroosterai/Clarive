using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfSystemConfigRepository(ClariveDbContext db) : ISystemConfigRepository
{
    public async Task<SystemConfig?> GetAsync(CancellationToken ct = default)
    {
        return await db.SystemConfigs.FirstOrDefaultAsync(c => c.Id == 1, ct);
    }

    public async Task SaveAsync(SystemConfig config, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
    }
}
