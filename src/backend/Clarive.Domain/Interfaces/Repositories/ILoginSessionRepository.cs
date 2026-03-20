using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface ILoginSessionRepository
{
    Task<LoginSession> CreateAsync(LoginSession session, CancellationToken ct = default);
    Task<List<LoginSession>> GetByUserAsync(
        Guid userId,
        int limit = 50,
        CancellationToken ct = default
    );
    Task<bool> RevokeAsync(Guid userId, Guid sessionId, CancellationToken ct = default);
    Task<int> RevokeAllExceptAsync(
        Guid userId,
        Guid currentRefreshTokenId,
        CancellationToken ct = default
    );
}
