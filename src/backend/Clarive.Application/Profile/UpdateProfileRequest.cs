namespace Clarive.Application.Profile;

public record UpdateProfileRequest(
    string? Name = null,
    string? Email = null,
    string? CurrentPassword = null,
    string? NewPassword = null,
    string? ThemePreference = null
);
