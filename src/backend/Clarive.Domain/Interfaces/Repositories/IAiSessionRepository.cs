using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IAiSessionRepository
{
    Task<AiSession> CreateAsync(AiSession session, CancellationToken ct = default);
    Task<AiSession?> GetByIdAsync(Guid tenantId, Guid sessionId, CancellationToken ct = default);
    Task UpdateAsync(AiSession session, CancellationToken ct = default);
}
