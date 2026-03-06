using Clarive.Api.Models.Entities;

namespace Clarive.Api.Helpers;

public static class AvatarHelpers
{
    public static string? TenantAvatarUrl(Tenant? tenant)
        => tenant?.AvatarPath != null ? $"/api/tenants/{tenant.Id}/avatar" : null;

    public static string? UserAvatarUrl(User user)
        => user.AvatarPath != null ? $"/api/users/{user.Id}/avatar" : null;
}
