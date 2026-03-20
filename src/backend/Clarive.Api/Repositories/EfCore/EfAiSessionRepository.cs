using Clarive.Api.Data;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Repositories.EfCore;

public class EfAiSessionRepository(ClariveDbContext db) : IAiSessionRepository
{
    public async Task<AiSession> CreateAsync(AiSession session, CancellationToken ct = default)
    {
        db.AiSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return session;
    }

    public async Task<AiSession?> GetByIdAsync(
        Guid tenantId,
        Guid sessionId,
        CancellationToken ct = default
    )
    {
        return await db.AiSessions.FirstOrDefaultAsync(
            s => s.Id == sessionId && s.TenantId == tenantId,
            ct
        );
    }

    public async Task UpdateAsync(AiSession session, CancellationToken ct = default)
    {
        db.AiSessions.Update(session);
        await db.SaveChangesAsync(ct);
    }
}
