namespace Clarive.Api.Services.Interfaces;

public record GoogleUserInfo(string GoogleId, string Email, string Name);

public interface IGoogleAuthService
{
    bool IsConfigured { get; }

    /// <summary>
    /// Validates a Google ID token and extracts user info.
    /// Throws if the token is invalid.
    /// </summary>
    Task<GoogleUserInfo> ValidateIdTokenAsync(string idToken, CancellationToken ct = default);
}
