namespace Clarive.Application.Workspaces;

public record WorkspaceDto(
    Guid Id,
    string Name,
    string Role,
    bool IsPersonal,
    int MemberCount,
    string? AvatarUrl
);
