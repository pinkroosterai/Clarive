using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByGoogleIdAsync(string googleId, CancellationToken ct = default);
    Task<User?> GetByIdAsync(Guid tenantId, Guid userId, CancellationToken ct = default);
    Task<User?> GetByIdCrossTenantsAsync(Guid userId, CancellationToken ct = default);
    Task<Dictionary<Guid, User>> GetByIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> userIds,
        CancellationToken ct = default
    );
    Task<List<User>> GetByTenantAsync(Guid tenantId, CancellationToken ct = default);
    Task<(List<User> Users, int Total)> GetByTenantPagedAsync(
        Guid tenantId,
        int page,
        int pageSize,
        CancellationToken ct = default
    );
    Task<User> CreateAsync(User user, CancellationToken ct = default);
    Task<User> UpdateAsync(User user, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid userId, CancellationToken ct = default);
    Task<bool> AnyUsersExistAsync(CancellationToken ct = default);
    Task<(List<User> Users, int Total)> GetAllUsersPagedAsync(
        int page,
        int pageSize,
        string? search,
        string? role,
        string? authType,
        string? sortBy,
        bool sortDesc,
        CancellationToken ct = default
    );
}
