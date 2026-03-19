using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IAiSessionRepository
{
    Task<AiSession> CreateAsync(AiSession session, CancellationToken ct = default);
    Task<AiSession?> GetByIdAsync(Guid tenantId, Guid sessionId, CancellationToken ct = default);
    Task UpdateAsync(AiSession session, CancellationToken ct = default);
}
