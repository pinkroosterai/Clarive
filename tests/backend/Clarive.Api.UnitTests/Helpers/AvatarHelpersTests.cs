using Clarive.Core.Helpers;
using Clarive.Domain.Entities;
using FluentAssertions;

namespace Clarive.Api.UnitTests.Helpers;

public class AvatarHelpersTests
{
    [Fact]
    public void TenantAvatarUrl_WithAvatar_ReturnsUrl()
    {
        var tenantId = Guid.NewGuid();
        var tenant = new Tenant { Id = tenantId, AvatarPath = "/avatars/tenant.png" };

        AvatarHelpers.TenantAvatarUrl(tenant).Should().Be($"/api/tenants/{tenantId}/avatar");
    }

    [Fact]
    public void TenantAvatarUrl_NoAvatar_ReturnsNull()
    {
        var tenant = new Tenant { Id = Guid.NewGuid(), AvatarPath = null };
        AvatarHelpers.TenantAvatarUrl(tenant).Should().BeNull();
    }

    [Fact]
    public void TenantAvatarUrl_NullTenant_ReturnsNull()
    {
        AvatarHelpers.TenantAvatarUrl(null).Should().BeNull();
    }

    [Fact]
    public void UserAvatarUrl_WithAvatar_ReturnsUrl()
    {
        var userId = Guid.NewGuid();
        var user = new User { Id = userId, AvatarPath = "/avatars/user.png" };

        AvatarHelpers.UserAvatarUrl(user).Should().Be($"/api/users/{userId}/avatar");
    }

    [Fact]
    public void UserAvatarUrl_NoAvatar_ReturnsNull()
    {
        var user = new User { Id = Guid.NewGuid(), AvatarPath = null };
        AvatarHelpers.UserAvatarUrl(user).Should().BeNull();
    }
}
