using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfInvitationRepository(ClariveDbContext db) : IInvitationRepository
{
    public async Task<Invitation> CreateAsync(Invitation invitation, CancellationToken ct = default)
    {
        db.Invitations.Add(invitation);
        await db.SaveChangesAsync(ct);
        return invitation;
    }

    public async Task<Invitation?> GetByIdAsync(
        Guid tenantId,
        Guid id,
        CancellationToken ct = default
    )
    {
        return await db.Invitations.FirstOrDefaultAsync(
            i => i.Id == id && i.TenantId == tenantId,
            ct
        );
    }

    public async Task<Invitation?> GetByTokenHashAsync(
        string tokenHash,
        CancellationToken ct = default
    )
    {
        return await db
            .Invitations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.TokenHash == tokenHash, ct);
    }

    public async Task<Invitation?> GetActiveByEmailAsync(
        Guid tenantId,
        string email,
        CancellationToken ct = default
    )
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await db.Invitations.FirstOrDefaultAsync(
            i => i.TenantId == tenantId && i.Email == normalized && i.ExpiresAt > DateTime.UtcNow,
            ct
        );
    }

    public async Task<List<Invitation>> GetActiveByTenantAsync(
        Guid tenantId,
        CancellationToken ct = default
    )
    {
        return await db
            .Invitations.AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<Invitation> UpdateAsync(Invitation invitation, CancellationToken ct = default)
    {
        await db.SaveChangesAsync(ct);
        return invitation;
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default)
    {
        var invitation = await db.Invitations.FirstOrDefaultAsync(
            i => i.Id == id && i.TenantId == tenantId,
            ct
        );
        if (invitation is null)
            return false;
        db.Invitations.Remove(invitation);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> DeleteExpiredAsync(Guid tenantId, CancellationToken ct = default)
    {
        return await db
            .Invitations.Where(i => i.TenantId == tenantId && i.ExpiresAt <= DateTime.UtcNow)
            .ExecuteDeleteAsync(ct);
    }

    public async Task<List<Invitation>> GetPendingByUserIdAsync(
        Guid userId,
        CancellationToken ct = default
    )
    {
        return await db
            .Invitations.IgnoreQueryFilters()
            .AsNoTracking()
            .Where(i => i.TargetUserId == userId && i.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<Invitation?> GetByIdCrossTenantsAsync(Guid id, CancellationToken ct = default)
    {
        return await db.Invitations.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<bool> DeleteCrossTenantsAsync(Guid id, CancellationToken ct = default)
    {
        var invitation = await db
            .Invitations.IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == id, ct);
        if (invitation is null)
            return false;
        db.Invitations.Remove(invitation);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
