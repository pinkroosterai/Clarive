using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface ITenantRepository
{
    Task<Tenant> CreateAsync(Tenant tenant, CancellationToken ct = default);
    Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Dictionary<Guid, Tenant>> GetByIdsAsync(
        IEnumerable<Guid> ids,
        CancellationToken ct = default
    );
    Task UpdateAsync(Tenant tenant, CancellationToken ct = default);
}
