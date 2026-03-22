using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfSuperAdminRepository(ClariveDbContext db, IUnitOfWork unitOfWork) : ISuperAdminRepository
{
    public async Task<Dictionary<Guid, List<UserWorkspaceInfo>>> GetUserWorkspacesAsync(
        List<Guid> userIds,
        CancellationToken ct = default
    )
    {
        var memberships = await db
            .TenantMemberships.IgnoreQueryFilters()
            .Where(m => userIds.Contains(m.UserId))
            .Join(
                db.Tenants,
                m => m.TenantId,
                t => t.Id,
                (m, t) => new
                {
                    m.UserId,
                    m.TenantId,
                    TenantName = t.Name,
                    m.Role,
                }
            )
            .ToListAsync(ct);

        return memberships
            .GroupBy(m => m.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(m => new UserWorkspaceInfo(m.TenantId, m.TenantName, m.Role)).ToList()
            );
    }

    public async Task HardDeleteUserWithMembershipsAsync(User user, CancellationToken ct = default)
    {
        await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                var memberships = await db
                    .TenantMemberships.IgnoreQueryFilters()
                    .Where(m => m.UserId == user.Id)
                    .ToListAsync(ct);
                db.TenantMemberships.RemoveRange(memberships);
                db.Users.Remove(user);
                await db.SaveChangesAsync(ct);
            },
            ct
        );
    }
}
