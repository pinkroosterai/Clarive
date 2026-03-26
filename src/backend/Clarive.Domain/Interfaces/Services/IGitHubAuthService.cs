namespace Clarive.Domain.Interfaces.Services;

public record GitHubUserInfo(string GitHubId, string Email, string Name, string? AvatarUrl);

public interface IGitHubAuthService
{
    bool IsConfigured { get; }

    /// <summary>
    /// Builds the GitHub OAuth authorization URL with the given redirect URI and CSRF state token.
    /// </summary>
    string GetAuthorizationUrl(string redirectUri, string state);

    /// <summary>
    /// Exchanges an authorization code for an access token, then fetches the GitHub user profile.
    /// Falls back to /user/emails if the user's email is private.
    /// </summary>
    Task<GitHubUserInfo> ExchangeCodeForUserAsync(
        string code,
        string redirectUri,
        CancellationToken ct = default
    );
}
