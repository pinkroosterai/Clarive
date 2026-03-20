using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfFavoriteRepository(ClariveDbContext db) : IFavoriteRepository
{
    public async Task<bool> ExistsAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        return await db.EntryFavorites.AnyAsync(
            f => f.TenantId == tenantId && f.UserId == userId && f.EntryId == entryId,
            ct
        );
    }

    public async Task AddAsync(EntryFavorite favorite, CancellationToken ct = default)
    {
        db.EntryFavorites.Add(favorite);
        await db.SaveChangesAsync(ct);
    }

    public async Task RemoveAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        await db
            .EntryFavorites.Where(f =>
                f.TenantId == tenantId && f.UserId == userId && f.EntryId == entryId
            )
            .ExecuteDeleteAsync(ct);
    }

    public async Task<HashSet<Guid>> GetFavoritedEntryIdsAsync(
        Guid tenantId,
        Guid userId,
        List<Guid> entryIds,
        CancellationToken ct = default
    )
    {
        if (entryIds.Count == 0)
            return [];

        var ids = await db
            .EntryFavorites.AsNoTracking()
            .Where(f =>
                f.TenantId == tenantId && f.UserId == userId && entryIds.Contains(f.EntryId)
            )
            .Select(f => f.EntryId)
            .ToListAsync(ct);

        return ids.ToHashSet();
    }

    public async Task<List<(Guid EntryId, DateTime CreatedAt)>> GetByUserAsync(
        Guid tenantId,
        Guid userId,
        int limit,
        CancellationToken ct = default
    )
    {
        var rows = await db
            .EntryFavorites.AsNoTracking()
            .Where(f => f.TenantId == tenantId && f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Take(limit)
            .Select(f => new { f.EntryId, f.CreatedAt })
            .ToListAsync(ct);

        return rows.Select(r => (r.EntryId, r.CreatedAt)).ToList();
    }
}
