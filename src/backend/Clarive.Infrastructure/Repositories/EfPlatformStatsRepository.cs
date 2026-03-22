using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Infrastructure.Repositories;

public class EfPlatformStatsRepository(ClariveDbContext db) : IPlatformStatsRepository
{
    public async Task<PlatformStats> GetPlatformStatsAsync(CancellationToken ct = default)
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

        return new PlatformStats(
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
}
