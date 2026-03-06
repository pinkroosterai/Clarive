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
