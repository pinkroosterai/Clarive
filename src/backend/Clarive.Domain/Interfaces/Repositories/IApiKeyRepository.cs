using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IApiKeyRepository
{
    Task<List<ApiKey>> GetByTenantAsync(Guid tenantId, CancellationToken ct = default);
    Task<ApiKey?> GetByIdAsync(Guid tenantId, Guid keyId, CancellationToken ct = default);
    Task<ApiKey?> GetByHashAsync(string keyHash, CancellationToken ct = default);
    Task<ApiKey> CreateAsync(ApiKey key, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid keyId, CancellationToken ct = default);
    Task TouchLastUsedAsync(Guid keyId, CancellationToken ct = default);
}
