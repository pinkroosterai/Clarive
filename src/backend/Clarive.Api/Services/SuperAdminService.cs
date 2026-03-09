using System.Security.Cryptography;
using Clarive.Api.Auth;
using Clarive.Api.Data;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Services;

public class SuperAdminService(
    ClariveDbContext db,
    IUserRepository userRepo,
    PasswordHasher passwordHasher) : ISuperAdminService
{
    public async Task<PlatformStatsResponse> GetPlatformStatsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var days7 = now.AddDays(-7);
        var days30 = now.AddDays(-30);

        // Users & Growth
        var activeUsers = db.Users.IgnoreQueryFilters().Where(u => u.DeletedAt == null);
        var totalUsers = await activeUsers.CountAsync(ct);
        var newUsers7d = await activeUsers.CountAsync(u => u.CreatedAt >= days7, ct);
        var newUsers30d = await activeUsers.CountAsync(u => u.CreatedAt >= days30, ct);
        var verifiedPct = totalUsers > 0
            ? (double)await activeUsers.CountAsync(u => u.EmailVerified, ct) / totalUsers
            : 0;
        var onboardedPct = totalUsers > 0
            ? (double)await activeUsers.CountAsync(u => u.OnboardingCompleted, ct) / totalUsers
            : 0;
        var pendingDeletion = await activeUsers.CountAsync(u => u.DeleteScheduledAt != null, ct);
        var googleAuthUsers = await activeUsers.CountAsync(u => u.GoogleId != null, ct);

        // Workspaces
        var totalWorkspaces = await db.Tenants.CountAsync(t => t.DeletedAt == null, ct);
        var allMemberships = db.TenantMemberships.IgnoreQueryFilters();
        var sharedWorkspaces = await allMemberships
            .Where(m => !m.IsPersonal)
            .Select(m => m.TenantId)
            .Distinct()
            .CountAsync(ct);
        var avgMembersPerWorkspace = sharedWorkspaces > 0
            ? (double)await allMemberships.CountAsync(m => !m.IsPersonal, ct) / sharedWorkspaces
            : 0;
        var allInvitations = db.Invitations.IgnoreQueryFilters();
        var pendingInvitations = await allInvitations
            .CountAsync(i => i.TargetUserId == null && i.ExpiresAt > now, ct);
        var totalInvitations = await allInvitations.CountAsync(ct);
        var acceptedInvitations = await allInvitations.CountAsync(i => i.TargetUserId != null, ct);
        var invitationAcceptRate = totalInvitations > 0
            ? (double)acceptedInvitations / totalInvitations
            : 0;

        // Content
        var allEntries = db.PromptEntries.IgnoreQueryFilters();
        var totalEntries = await allEntries.CountAsync(ct);
        var publishedVersions = await db.PromptEntryVersions
            .CountAsync(v => v.VersionState == VersionState.Published, ct);
        var entriesCreated7d = await allEntries.CountAsync(e => e.CreatedAt >= days7, ct);
        var trashedEntries = await allEntries.CountAsync(e => e.IsTrashed, ct);
        var allAiSessions = db.AiSessions.IgnoreQueryFilters();
        var totalAiSessions = await allAiSessions.CountAsync(ct);
        var aiSessions7d = await allAiSessions.CountAsync(s => s.CreatedAt >= days7, ct);

        var totalApiKeys = await db.ApiKeys.IgnoreQueryFilters().CountAsync(ct);

        return new PlatformStatsResponse(
            totalUsers,
            newUsers7d,
            newUsers30d,
            verifiedPct,
            onboardedPct,
            pendingDeletion,
            googleAuthUsers,
            totalWorkspaces,
            sharedWorkspaces,
            avgMembersPerWorkspace,
            pendingInvitations,
            invitationAcceptRate,
            totalEntries,
            publishedVersions,
            entriesCreated7d,
            trashedEntries,
            totalAiSessions,
            aiSessions7d,
            totalApiKeys);
    }

    public async Task<(List<SuperUserResponse> Users, int Total)> GetAllUsersPagedAsync(
        int page, int pageSize, string? search, string? sortBy, bool sortDesc, CancellationToken ct)
    {
        var (users, total) = await userRepo.GetAllUsersPagedAsync(page, pageSize, search, sortBy, sortDesc, ct);

        var userIds = users.Select(u => u.Id).ToList();

        var memberships = await db.TenantMemberships
            .IgnoreQueryFilters()
            .Where(m => userIds.Contains(m.UserId))
            .Join(db.Tenants,
                m => m.TenantId,
                t => t.Id,
                (m, t) => new { m.UserId, m.TenantId, TenantName = t.Name, m.Role, m.IsPersonal })
            .ToListAsync(ct);

        var membershipsByUser = memberships
            .GroupBy(m => m.UserId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var response = users.Select(u =>
        {
            var workspaces = membershipsByUser.TryGetValue(u.Id, out var ms)
                ? ms.Select(m => new SuperUserWorkspace(m.TenantId, m.TenantName, m.Role.ToString())).ToList()
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
                workspaces);
        }).ToList();

        return (response, total);
    }

    public async Task<bool> HardDeleteUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return false;

        var memberships = await db.TenantMemberships
            .IgnoreQueryFilters()
            .Where(m => m.UserId == userId)
            .ToListAsync(ct);
        db.TenantMemberships.RemoveRange(memberships);
        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);

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

    public async Task<ErrorOr<string>> ResetUserPasswordAsync(
        Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return Error.NotFound("NOT_FOUND", "User not found.");

        if (user.GoogleId != null)
            return Error.Validation("GOOGLE_ACCOUNT", "Cannot reset password for Google accounts.");

        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        var passwordChars = new char[16];
        for (var i = 0; i < passwordChars.Length; i++)
            passwordChars[i] = chars[RandomNumberGenerator.GetInt32(chars.Length)];
        var password = new string(passwordChars);

        user.PasswordHash = passwordHasher.Hash(password);
        await userRepo.UpdateAsync(user, ct);

        return password;
    }
}
