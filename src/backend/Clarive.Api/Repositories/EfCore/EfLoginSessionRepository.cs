using Clarive.Api.Data;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfLoginSessionRepository(ClariveDbContext db) : ILoginSessionRepository
{
    public async Task<LoginSession> CreateAsync(
        LoginSession session,
        CancellationToken ct = default
    )
    {
        db.LoginSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return session;
    }

    public async Task<List<LoginSession>> GetByUserAsync(
        Guid userId,
        int limit = 50,
        CancellationToken ct = default
    )
    {
        var now = DateTime.UtcNow;

        return await db
            .LoginSessions.AsNoTracking()
            .Join(
                db.RefreshTokens.AsNoTracking(),
                ls => ls.RefreshTokenId,
                rt => rt.Id,
                (ls, rt) => new { Session = ls, Token = rt }
            )
            .Where(x =>
                x.Session.UserId == userId && x.Token.RevokedAt == null && x.Token.ExpiresAt > now
            )
            .OrderByDescending(x => x.Session.CreatedAt)
            .Take(limit)
            .Select(x => x.Session)
            .ToListAsync(ct);
    }

    public async Task<bool> RevokeAsync(Guid userId, Guid sessionId, CancellationToken ct = default)
    {
        var session = await db
            .LoginSessions.AsNoTracking()
            .FirstOrDefaultAsync(ls => ls.Id == sessionId && ls.UserId == userId, ct);

        if (session is null)
            return false;

        var updated = await db
            .RefreshTokens.Where(rt => rt.Id == session.RefreshTokenId && rt.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(rt => rt.RevokedAt, DateTime.UtcNow), ct);

        return updated > 0;
    }

    public async Task<int> RevokeAllExceptAsync(
        Guid userId,
        Guid currentRefreshTokenId,
        CancellationToken ct = default
    )
    {
        return await db
            .RefreshTokens.Where(rt =>
                rt.UserId == userId && rt.Id != currentRefreshTokenId && rt.RevokedAt == null
            )
            .ExecuteUpdateAsync(s => s.SetProperty(rt => rt.RevokedAt, DateTime.UtcNow), ct);
    }
}
