using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IAccountPurgeRepository
{
    Task<List<Tenant>> GetExpiredTenantsAsync(int batchSize, CancellationToken ct = default);
    Task RemoveTenantsAsync(List<Tenant> tenants, CancellationToken ct = default);
    Task<List<User>> GetExpiredUsersAsync(int batchSize, CancellationToken ct = default);
    Task RemoveUsersAsync(List<User> users, CancellationToken ct = default);
}
