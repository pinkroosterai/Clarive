using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface ITenantMembershipRepository
{
    /// <summary>Get all workspace memberships for a user (cross-tenant, for workspace list/switcher).</summary>
    Task<List<TenantMembership>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Get a specific membership (for authorization checks).</summary>
    Task<TenantMembership?> GetAsync(Guid userId, Guid tenantId, CancellationToken ct = default);

    /// <summary>Get all memberships for a tenant (for member listing).</summary>
    Task<List<TenantMembership>> GetByTenantIdAsync(Guid tenantId, CancellationToken ct = default);

    /// <summary>Create a new membership.</summary>
    Task<TenantMembership> CreateAsync(TenantMembership membership, CancellationToken ct = default);

    /// <summary>Update a membership (e.g. role change).</summary>
    Task UpdateAsync(TenantMembership membership, CancellationToken ct = default);

    /// <summary>Delete a membership (leave workspace / remove member).</summary>
    Task DeleteAsync(Guid userId, Guid tenantId, CancellationToken ct = default);

    /// <summary>Count members per tenant in a single query.</summary>
    Task<Dictionary<Guid, int>> CountMembersByTenantIdsAsync(
        IEnumerable<Guid> tenantIds,
        CancellationToken ct = default
    );

    /// <summary>Count admins in a tenant (for "last admin" safety check).</summary>
    Task<int> CountAdminsAsync(Guid tenantId, CancellationToken ct = default);
}
