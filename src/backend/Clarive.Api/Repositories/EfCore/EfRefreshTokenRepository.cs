using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfRefreshTokenRepository(ClariveDbContext db) : IRefreshTokenRepository
{
    public async Task<RefreshToken> CreateAsync(RefreshToken token, CancellationToken ct = default)
    {
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync(ct);
        return token;
    }

    public async Task<RefreshToken?> GetByHashAsync(
        string tokenHash,
        CancellationToken ct = default
    )
    {
        return await db.RefreshTokens.FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash, ct);
    }

    public async Task RevokeAsync(Guid tokenId, Guid? replacedById, CancellationToken ct = default)
    {
        await db
            .RefreshTokens.Where(rt => rt.Id == tokenId && rt.RevokedAt == null)
            .ExecuteUpdateAsync(
                s =>
                    s.SetProperty(rt => rt.RevokedAt, DateTime.UtcNow)
                        .SetProperty(rt => rt.ReplacedById, replacedById),
                ct
            );
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default)
    {
        await db
            .RefreshTokens.Where(rt => rt.UserId == userId && rt.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(rt => rt.RevokedAt, DateTime.UtcNow), ct);
    }

    public async Task CleanupExpiredAsync(CancellationToken ct = default)
    {
        await db.RefreshTokens.Where(rt => rt.ExpiresAt < DateTime.UtcNow).ExecuteDeleteAsync(ct);
    }
}
