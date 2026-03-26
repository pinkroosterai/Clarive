using Clarive.Auth.Jwt;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Security;
using System.Security.Cryptography;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Application.Users.Contracts;
using ErrorOr;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Clarive.Application.SuperAdmin.Services;

public class SuperAdminService(
    IPlatformStatsRepository statsRepo,
    ISuperAdminRepository adminRepo,
    IUserRepository userRepo,
    PasswordHasher passwordHasher,
    IUserWorkspaceCreationService workspaceCreation,
    IUnitOfWork unitOfWork,
    ITenantMembershipRepository membershipRepo,
    ITenantRepository tenantRepo,
    ITokenRepository tokenRepo,
    JwtService jwtService,
    IEmailService emailService,
    IOptions<AppSettings> appSettings,
    IConfiguration configuration
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
                    u.GitHubId != null,
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

    public async Task<ErrorOr<CreateUserResponse>> CreateUserAsync(
        CreateUserRequest request,
        CancellationToken ct
    )
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var workspaces = request.Workspaces ?? [];

        if (await userRepo.GetByEmailAsync(email, ct) is not null)
            return Error.Conflict("EMAIL_ALREADY_EXISTS", "A user with this email already exists.");

        // Validate workspace assignments
        if (workspaces.Count > 0)
        {
            var workspaceIds = workspaces.Select(w => w.WorkspaceId).ToList();
            if (workspaceIds.Distinct().Count() != workspaceIds.Count)
                return Error.Validation(
                    "DUPLICATE_WORKSPACE",
                    "The same workspace cannot be assigned twice."
                );

            var existingTenants = await tenantRepo.GetByIdsAsync(workspaceIds, ct);
            var missing = workspaceIds.Where(id => !existingTenants.ContainsKey(id)).ToList();
            if (missing.Count > 0)
                return Error.NotFound(
                    "WORKSPACE_NOT_FOUND",
                    $"Workspace(s) not found: {string.Join(", ", missing)}"
                );

            foreach (var ws in workspaces)
            {
                if (!Enum.TryParse<UserRole>(ws.Role, ignoreCase: true, out _))
                    return Error.Validation(
                        "INVALID_ROLE",
                        $"Invalid role '{ws.Role}'. Must be Admin, Editor, or Viewer."
                    );
            }
        }

        var emailProvider = configuration["Email:Provider"] ?? "none";
        var emailEnabled = !string.Equals(emailProvider, "none", StringComparison.OrdinalIgnoreCase);

        // Generate password (always needed for account creation)
        string? generatedPassword = null;
        string passwordHash;

        if (emailEnabled)
        {
            var tempPassword = GenerateRandomPassword();
            passwordHash = passwordHasher.Hash(tempPassword);
        }
        else
        {
            generatedPassword = GenerateRandomPassword();
            passwordHash = passwordHasher.Hash(generatedPassword);
        }

        return await unitOfWork.ExecuteInTransactionAsync(
            async () =>
            {
                // Create user with personal workspace
                var (user, _) = await workspaceCreation.CreateUserWithPersonalWorkspaceAsync(
                    email,
                    request.Name.Trim(),
                    passwordHash: passwordHash,
                    googleId: null,
                    emailVerified: true,
                    ct: ct
                );

                // Add memberships to assigned workspaces
                foreach (var ws in workspaces)
                {
                    var role = Enum.Parse<UserRole>(ws.Role, ignoreCase: true);
                    await membershipRepo.CreateAsync(
                        new TenantMembership
                        {
                            Id = Guid.NewGuid(),
                            UserId = user.Id,
                            TenantId = ws.WorkspaceId,
                            Role = role,
                            IsPersonal = false,
                            JoinedAt = DateTime.UtcNow,
                        },
                        ct
                    );
                }

                // Send password setup email if email is configured
                if (emailEnabled)
                {
                    var (rawToken, _) = jwtService.GenerateRefreshToken();
                    await tokenRepo.CreateResetTokenAsync(
                        new PasswordResetToken
                        {
                            Id = Guid.NewGuid(),
                            UserId = user.Id,
                            TokenHash = JwtService.HashRefreshToken(rawToken),
                            ExpiresAt = DateTime.UtcNow.AddHours(24),
                            CreatedAt = DateTime.UtcNow,
                        },
                        ct
                    );

                    var resetUrl = $"{appSettings.Value.FrontendUrl}/reset-password?token={rawToken}";
                    await emailService.SendPasswordResetEmailAsync(
                        user.Email,
                        user.Name,
                        resetUrl,
                        ct
                    );
                }

                return (ErrorOr<CreateUserResponse>)
                    new CreateUserResponse(user.Id, user.Email, user.Name, generatedPassword);
            },
            ct
        );
    }

    private static string GenerateRandomPassword()
    {
        const string chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        var passwordChars = new char[16];
        for (var i = 0; i < passwordChars.Length; i++)
            passwordChars[i] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
        return new string(passwordChars);
    }
}
