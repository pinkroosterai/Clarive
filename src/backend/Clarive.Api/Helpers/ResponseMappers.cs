using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;

namespace Clarive.Api.Helpers;

/// <summary>
/// Shared presentation mapping functions used across multiple endpoint groups.
/// </summary>
internal static class ResponseMappers
{
    internal static UserDto ToUserDto(User user) =>
        new(user.Id, user.Email, user.Name, user.Role.ToString().ToLower(), user.EmailVerified, user.OnboardingCompleted,
            AvatarHelpers.UserAvatarUrl(user), user.PasswordHash is not null, user.IsSuperUser, user.ThemePreference);

    internal static async Task<List<WorkspaceDto>> BuildWorkspaceListAsync(
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        Guid userId,
        CancellationToken ct)
    {
        var memberships = await membershipRepo.GetByUserIdAsync(userId, ct);
        if (memberships.Count == 0) return [];

        var tenantIds = memberships.Select(m => m.TenantId).ToList();
        var tenants = await tenantRepo.GetByIdsAsync(tenantIds, ct);
        var memberCounts = await membershipRepo.CountMembersByTenantIdsAsync(tenantIds, ct);

        var workspaces = new List<WorkspaceDto>();
        foreach (var m in memberships)
        {
            if (!tenants.TryGetValue(m.TenantId, out var tenant)) continue;

            workspaces.Add(new WorkspaceDto(
                m.TenantId,
                tenant.Name,
                m.Role.ToString().ToLower(),
                m.IsPersonal,
                memberCounts.GetValueOrDefault(m.TenantId, 0),
                AvatarHelpers.TenantAvatarUrl(tenant)));
        }

        return workspaces;
    }
}
