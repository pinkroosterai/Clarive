using System.Security.Cryptography;
using Clarive.Api.Auth;
using Clarive.Api.Data;
using Clarive.Api.Helpers;
using Clarive.Domain.Errors;
using Clarive.Domain.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Services;

public class SuperAdminService(
    ClariveDbContext db,
    IUserRepository userRepo,
    PasswordHasher passwordHasher
) : ISuperAdminService
{
    public async Task<PlatformStatsResponse> GetPlatformStatsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var days7 = now.AddDays(-7);
        var days30 = now.AddDays(-30);

        // Users & Growth — single query with conditional counts
        var userStats = await db
            .Users.IgnoreQueryFilters()
            .Where(u => u.DeletedAt == null)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                New7d = g.Count(u => u.CreatedAt >= days7),
                New30d = g.Count(u => u.CreatedAt >= days30),
                Verified = g.Count(u => u.EmailVerified),
                Onboarded = g.Count(u => u.OnboardingCompleted),
                PendingDeletion = g.Count(u => u.DeleteScheduledAt != null),
                GoogleAuth = g.Count(u => u.GoogleId != null),
            })
            .FirstOrDefaultAsync(ct);

        var totalUsers = userStats?.Total ?? 0;
        var verifiedPct = totalUsers > 0 ? (double)userStats!.Verified / totalUsers : 0;
        var onboardedPct = totalUsers > 0 ? (double)userStats!.Onboarded / totalUsers : 0;

        // Workspaces — single query
        var totalWorkspaces = await db.Tenants.CountAsync(t => t.DeletedAt == null, ct);
        var membershipStats = await db
            .TenantMemberships.IgnoreQueryFilters()
            .Where(m => !m.IsPersonal)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                SharedWorkspaces = g.Select(m => m.TenantId).Distinct().Count(),
                TotalSharedMembers = g.Count(),
            })
            .FirstOrDefaultAsync(ct);
        var sharedWorkspaces = membershipStats?.SharedWorkspaces ?? 0;
        var avgMembersPerWorkspace =
            sharedWorkspaces > 0
                ? (double)membershipStats!.TotalSharedMembers / sharedWorkspaces
                : 0;

        // Invitations — single query
        var invitationStats = await db
            .Invitations.IgnoreQueryFilters()
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Pending = g.Count(i => i.TargetUserId == null && i.ExpiresAt > now),
                Accepted = g.Count(i => i.TargetUserId != null),
            })
            .FirstOrDefaultAsync(ct);
        var totalInvitations = invitationStats?.Total ?? 0;
        var invitationAcceptRate =
            totalInvitations > 0 ? (double)invitationStats!.Accepted / totalInvitations : 0;

        // Content — single query for entries
        var entryStats = await db
            .PromptEntries.IgnoreQueryFilters()
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Created7d = g.Count(e => e.CreatedAt >= days7),
                Trashed = g.Count(e => e.IsTrashed),
            })
            .FirstOrDefaultAsync(ct);

        var publishedVersions = await db.PromptEntryVersions.CountAsync(
            v => v.VersionState == VersionState.Published,
            ct
        );

        // AI sessions — single query
        var aiStats = await db
            .AiSessions.IgnoreQueryFilters()
            .GroupBy(_ => 1)
            .Select(g => new { Total = g.Count(), Last7d = g.Count(s => s.CreatedAt >= days7) })
            .FirstOrDefaultAsync(ct);

        var totalApiKeys = await db.ApiKeys.IgnoreQueryFilters().CountAsync(ct);

        return new PlatformStatsResponse(
            totalUsers,
            userStats?.New7d ?? 0,
            userStats?.New30d ?? 0,
            verifiedPct,
            onboardedPct,
            userStats?.PendingDeletion ?? 0,
            userStats?.GoogleAuth ?? 0,
            totalWorkspaces,
            sharedWorkspaces,
            avgMembersPerWorkspace,
            invitationStats?.Pending ?? 0,
            invitationAcceptRate,
            entryStats?.Total ?? 0,
            publishedVersions,
            entryStats?.Created7d ?? 0,
            entryStats?.Trashed ?? 0,
            aiStats?.Total ?? 0,
            aiStats?.Last7d ?? 0,
            totalApiKeys
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

        var memberships = await db
            .TenantMemberships.IgnoreQueryFilters()
            .Where(m => userIds.Contains(m.UserId))
            .Join(
                db.Tenants,
                m => m.TenantId,
                t => t.Id,
                (m, t) =>
                    new
                    {
                        m.UserId,
                        m.TenantId,
                        TenantName = t.Name,
                        m.Role,
                        m.IsPersonal,
                    }
            )
            .ToListAsync(ct);

        var membershipsByUser = memberships
            .GroupBy(m => m.UserId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var response = users
            .Select(u =>
            {
                var workspaces = membershipsByUser.TryGetValue(u.Id, out var ms)
                    ? ms.Select(m => new SuperUserWorkspace(
                            m.TenantId,
                            m.TenantName,
                            m.Role.ToString()
                        ))
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

        await db.Database.InTransactionAsync(
            async () =>
            {
                var memberships = await db
                    .TenantMemberships.IgnoreQueryFilters()
                    .Where(m => m.UserId == userId)
                    .ToListAsync(ct);
                db.TenantMemberships.RemoveRange(memberships);
                db.Users.Remove(user);
                await db.SaveChangesAsync(ct);
            },
            ct
        );

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
