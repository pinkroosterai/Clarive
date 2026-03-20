using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IRefreshTokenRepository
{
    Task<RefreshToken> CreateAsync(RefreshToken token, CancellationToken ct = default);
    Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken ct = default);
    Task RevokeAsync(Guid tokenId, Guid? replacedById, CancellationToken ct = default);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct = default);
    Task CleanupExpiredAsync(CancellationToken ct = default);
}
