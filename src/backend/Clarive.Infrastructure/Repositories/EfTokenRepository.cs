using Clarive.Infrastructure.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfTokenRepository(ClariveDbContext db) : ITokenRepository
{
    // ── Email Verification ──

    public async Task<EmailVerificationToken> CreateVerificationTokenAsync(
        EmailVerificationToken token,
        CancellationToken ct = default
    )
    {
        db.EmailVerificationTokens.Add(token);
        await db.SaveChangesAsync(ct);
        return token;
    }

    public async Task<EmailVerificationToken?> GetVerificationByHashAsync(
        string tokenHash,
        CancellationToken ct = default
    )
    {
        return await db.EmailVerificationTokens.FirstOrDefaultAsync(
            t => t.TokenHash == tokenHash,
            ct
        );
    }

    public async Task MarkVerificationUsedAsync(Guid tokenId, CancellationToken ct = default)
    {
        await db
            .EmailVerificationTokens.Where(t => t.Id == tokenId && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow), ct);
    }

    public async Task<int> CountRecentVerificationTokensAsync(
        Guid userId,
        TimeSpan window,
        CancellationToken ct = default
    )
    {
        var cutoff = DateTime.UtcNow - window;
        return await db.EmailVerificationTokens.CountAsync(
            t => t.UserId == userId && t.CreatedAt > cutoff,
            ct
        );
    }

    // ── Password Reset ──

    public async Task<PasswordResetToken> CreateResetTokenAsync(
        PasswordResetToken token,
        CancellationToken ct = default
    )
    {
        db.PasswordResetTokens.Add(token);
        await db.SaveChangesAsync(ct);
        return token;
    }

    public async Task<PasswordResetToken?> GetResetByHashAsync(
        string tokenHash,
        CancellationToken ct = default
    )
    {
        return await db.PasswordResetTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);
    }

    public async Task MarkResetUsedAsync(Guid tokenId, CancellationToken ct = default)
    {
        await db
            .PasswordResetTokens.Where(t => t.Id == tokenId && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow), ct);
    }

    public async Task<int> CountRecentResetTokensAsync(
        Guid userId,
        TimeSpan window,
        CancellationToken ct = default
    )
    {
        var cutoff = DateTime.UtcNow - window;
        return await db.PasswordResetTokens.CountAsync(
            t => t.UserId == userId && t.CreatedAt > cutoff,
            ct
        );
    }
}
