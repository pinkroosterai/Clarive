using Clarive.Domain.Entities;
using Clarive.Domain.Enums;

namespace Clarive.Domain.Interfaces.Repositories;

/// <summary>
/// Workspace membership info for super-admin user listings.
/// </summary>
public record UserWorkspaceInfo(Guid TenantId, string TenantName, UserRole Role);

public interface ISuperAdminRepository
{
    /// <summary>
    /// Returns workspace memberships grouped by user ID for the given user IDs.
    /// </summary>
    Task<Dictionary<Guid, List<UserWorkspaceInfo>>> GetUserWorkspacesAsync(
        List<Guid> userIds,
        CancellationToken ct = default
    );

    /// <summary>
    /// Hard-deletes a user and all their tenant memberships in a single transaction.
    /// </summary>
    Task HardDeleteUserWithMembershipsAsync(User user, CancellationToken ct = default);
}
