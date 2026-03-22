namespace Clarive.Domain.Interfaces.Repositories;

/// <summary>
/// Raw platform-wide statistics for the super-admin dashboard.
/// </summary>
public record PlatformStats(
    int TotalUsers,
    int NewUsers7d,
    int NewUsers30d,
    double VerifiedPct,
    double OnboardedPct,
    int PendingDeletion,
    int GoogleAuthUsers,
    int TotalWorkspaces,
    int SharedWorkspaces,
    double AvgMembersPerWorkspace,
    int PendingInvitations,
    double InvitationAcceptRate,
    int TotalEntries,
    int PublishedVersions,
    int EntriesCreated7d,
    int TrashedEntries,
    int TotalAiSessions,
    int AiSessions7d,
    int TotalApiKeys
);

public interface IPlatformStatsRepository
{
    Task<PlatformStats> GetPlatformStatsAsync(CancellationToken ct = default);
}
