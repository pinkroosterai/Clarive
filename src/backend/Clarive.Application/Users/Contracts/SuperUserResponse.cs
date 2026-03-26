namespace Clarive.Application.Users.Contracts;

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
    List<SuperUserWorkspace> Workspaces
);

public record SuperUserWorkspace(Guid Id, string Name, string Role);

public record SuperUsersPagedResponse(
    List<SuperUserResponse> Users,
    int Total,
    int Page,
    int PageSize
);

public record ResetPasswordResponse(string NewPassword);

public record WorkspaceAssignment(
    [property: System.ComponentModel.DataAnnotations.Required]
    Guid WorkspaceId,
    [property: System.ComponentModel.DataAnnotations.Required]
    [property: System.ComponentModel.DataAnnotations.RegularExpression("^(Admin|Editor|Viewer)$")]
    string Role
);

public record CreateUserRequest(
    [property: System.ComponentModel.DataAnnotations.Required]
    [property: System.ComponentModel.DataAnnotations.StringLength(255)]
    string Name,
    [property: System.ComponentModel.DataAnnotations.Required]
    [property: System.ComponentModel.DataAnnotations.EmailAddress]
    string Email,
    List<WorkspaceAssignment>? Workspaces = null
);

public record CreateUserResponse(
    Guid Id,
    string Email,
    string Name,
    string? GeneratedPassword
);

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
    int TotalApiKeys
);
