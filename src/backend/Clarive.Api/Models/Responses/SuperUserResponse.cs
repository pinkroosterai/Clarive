namespace Clarive.Api.Models.Responses;

public record SuperUserResponse(
    Guid Id,
    string Name,
    string Email,
    string Role,
    bool EmailVerified,
    bool IsGoogleAccount,
    bool IsSuperUser,
    string? AvatarUrl,
    DateTime CreatedAt,
    DateTime? DeletedAt,
    List<SuperUserWorkspace> Workspaces);

public record SuperUserWorkspace(
    Guid Id,
    string Name,
    string Role);

public record SuperUsersPagedResponse(
    List<SuperUserResponse> Users,
    int Total,
    int Page,
    int PageSize);

public record ResetPasswordResponse(string NewPassword);

public record PlatformStatsResponse(
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
    int TotalApiKeys);
