using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface ITenantRepository
{
    Task<Tenant> CreateAsync(Tenant tenant, CancellationToken ct = default);
    Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Dictionary<Guid, Tenant>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);
    Task UpdateAsync(Tenant tenant, CancellationToken ct = default);
}
