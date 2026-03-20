using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Application.Account.Services;

public class UserWorkspaceCreationService(
    ITenantRepository tenantRepo,
    IUserRepository userRepo,
    ITenantMembershipRepository membershipRepo,
    IOnboardingSeeder onboardingSeeder
) : IUserWorkspaceCreationService
{
    public async Task<(User User, Tenant PersonalWorkspace)> CreateUserWithPersonalWorkspaceAsync(
        string email,
        string name,
        string? passwordHash,
        string? googleId,
        bool emailVerified,
        bool isSuperUser = false,
        CancellationToken ct = default
    )
    {
        var tenant = await tenantRepo.CreateAsync(
            new Tenant
            {
                Id = Guid.NewGuid(),
                Name = $"{name}'s workspace",
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        var user = await userRepo.CreateAsync(
            new User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Email = email,
                Name = name,
                PasswordHash = passwordHash,
                GoogleId = googleId,
                EmailVerified = emailVerified,
                IsSuperUser = isSuperUser,
                Role = UserRole.Admin,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        tenant.OwnerId = user.Id;
        await tenantRepo.UpdateAsync(tenant, ct);

        await membershipRepo.CreateAsync(
            new TenantMembership
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TenantId = tenant.Id,
                Role = UserRole.Admin,
                IsPersonal = true,
                JoinedAt = DateTime.UtcNow,
            },
            ct
        );

        await onboardingSeeder.SeedStarterTemplatesAsync(tenant.Id, user.Id, ct);

        return (user, tenant);
    }

    public Task SeedStarterTemplatesAsync(Guid tenantId, Guid userId, CancellationToken ct) =>
        onboardingSeeder.SeedStarterTemplatesAsync(tenantId, userId, ct);
}
