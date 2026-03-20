using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfShareLinkRepository(ClariveDbContext db) : IShareLinkRepository
{
    public async Task<ShareLink?> GetByTokenHashAsync(
        string tokenHash,
        CancellationToken ct = default
    )
    {
        return await db
            .ShareLinks.IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.TokenHash == tokenHash, ct);
    }

    public async Task<ShareLink?> GetByEntryIdAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        return await db
            .ShareLinks.AsNoTracking()
            .FirstOrDefaultAsync(
                s => s.TenantId == tenantId && s.EntryId == entryId && s.IsActive,
                ct
            );
    }

    public async Task<ShareLink> CreateAsync(ShareLink shareLink, CancellationToken ct = default)
    {
        db.ShareLinks.Add(shareLink);
        await db.SaveChangesAsync(ct);
        return shareLink;
    }

    public async Task<bool> DeleteByEntryIdAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    )
    {
        var link = await db.ShareLinks.FirstOrDefaultAsync(
            s => s.TenantId == tenantId && s.EntryId == entryId,
            ct
        );
        if (link is null)
            return false;
        db.ShareLinks.Remove(link);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task IncrementAccessCountAsync(Guid shareLinkId, CancellationToken ct = default)
    {
        await db
            .ShareLinks.Where(s => s.Id == shareLinkId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.AccessCount, p => p.AccessCount + 1), ct);
    }
}
