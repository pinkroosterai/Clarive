using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Security;
using System.Security.Cryptography;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Application.Users.Contracts;
using ErrorOr;

namespace Clarive.Application.SuperAdmin.Services;

public class SuperAdminService(
    IPlatformStatsRepository statsRepo,
    ISuperAdminRepository adminRepo,
    IUserRepository userRepo,
    PasswordHasher passwordHasher
) : ISuperAdminService
{
    public async Task<PlatformStatsResponse> GetPlatformStatsAsync(CancellationToken ct)
    {
        var s = await statsRepo.GetPlatformStatsAsync(ct);

        return new PlatformStatsResponse(
            s.TotalUsers,
            s.NewUsers7d,
            s.NewUsers30d,
            s.VerifiedPct,
            s.OnboardedPct,
            s.PendingDeletion,
            s.GoogleAuthUsers,
            s.TotalWorkspaces,
            s.SharedWorkspaces,
            s.AvgMembersPerWorkspace,
            s.PendingInvitations,
            s.InvitationAcceptRate,
            s.TotalEntries,
            s.PublishedVersions,
            s.EntriesCreated7d,
            s.TrashedEntries,
            s.TotalAiSessions,
            s.AiSessions7d,
            s.TotalApiKeys
        );
    }

    public async Task<(List<SuperUserResponse> Users, int Total)> GetAllUsersPagedAsync(
        int page,
        int pageSize,
        string? search,
        string? role,
        string? authType,
        string? sortBy,
        bool sortDesc,
        CancellationToken ct
    )
    {
        var (users, total) = await userRepo.GetAllUsersPagedAsync(
            page,
            pageSize,
            search,
            role,
            authType,
            sortBy,
            sortDesc,
            ct
        );

        var userIds = users.Select(u => u.Id).ToList();
        var membershipsByUser = await adminRepo.GetUserWorkspacesAsync(userIds, ct);

        var response = users
            .Select(u =>
            {
                var workspaces = membershipsByUser.TryGetValue(u.Id, out var ms)
                    ? ms.Select(m => new SuperUserWorkspace(m.TenantId, m.TenantName, m.Role.ToString()))
                        .ToList()
                    : [];

                return new SuperUserResponse(
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role.ToString(),
                    u.EmailVerified,
                    u.GoogleId != null,
                    u.IsSuperUser,
                    u.AvatarPath != null ? $"/api/users/{u.Id}/avatar" : null,
                    u.CreatedAt,
                    u.DeleteScheduledAt,
                    workspaces
                );
            })
            .ToList();

        return (response, total);
    }

    public async Task<bool> HardDeleteUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return false;

        await adminRepo.HardDeleteUserWithMembershipsAsync(user, ct);
        return true;
    }

    public async Task<bool> SoftDeleteUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return false;

        user.DeleteScheduledAt = DateTime.UtcNow;
        await userRepo.UpdateAsync(user, ct);

        return true;
    }

    public async Task<ErrorOr<string>> ResetUserPasswordAsync(Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return DomainErrors.UserNotFound;

        if (user.GoogleId != null)
            return Error.Validation("GOOGLE_ACCOUNT", "Cannot reset password for Google accounts.");

        const string chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        var passwordChars = new char[16];
        for (var i = 0; i < passwordChars.Length; i++)
            passwordChars[i] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
        var password = new string(passwordChars);

        user.PasswordHash = passwordHasher.Hash(password);
        await userRepo.UpdateAsync(user, ct);

        return password;
    }
}
