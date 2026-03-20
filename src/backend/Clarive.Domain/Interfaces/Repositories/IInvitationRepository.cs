using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IInvitationRepository
{
    Task<Invitation> CreateAsync(Invitation invitation, CancellationToken ct = default);
    Task<Invitation?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default);
    Task<Invitation?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<Invitation?> GetActiveByEmailAsync(
        Guid tenantId,
        string email,
        CancellationToken ct = default
    );
    Task<List<Invitation>> GetActiveByTenantAsync(Guid tenantId, CancellationToken ct = default);
    Task<Invitation> UpdateAsync(Invitation invitation, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default);
    Task<int> DeleteExpiredAsync(Guid tenantId, CancellationToken ct = default);
    Task<List<Invitation>> GetPendingByUserIdAsync(Guid userId, CancellationToken ct = default);
    Task<Invitation?> GetByIdCrossTenantsAsync(Guid id, CancellationToken ct = default);
    Task<bool> DeleteCrossTenantsAsync(Guid id, CancellationToken ct = default);
}
