namespace Clarive.Api.Models.Responses;

public record AuthResponse(string Token, string RefreshToken, UserDto User, List<WorkspaceDto>? Workspaces = null);

public record UserDto(Guid Id, string Email, string Name, string Role, bool EmailVerified, bool OnboardingCompleted, string? AvatarUrl, bool HasPassword, bool IsSuperUser, string? ThemePreference = null);

public record SessionDto(Guid Id, string IpAddress, string Browser, string Os, DateTime CreatedAt, bool IsCurrent);
