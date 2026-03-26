using Clarive.Domain.Interfaces.Services;

namespace Clarive.Auth.GitHub;

public class NullGitHubAuthService : IGitHubAuthService
{
    public bool IsConfigured => false;

    public string GetAuthorizationUrl(string redirectUri, string state) =>
        throw new InvalidOperationException("GitHub OAuth is not configured.");

    public Task<GitHubUserInfo> ExchangeCodeForUserAsync(
        string code,
        string redirectUri,
        CancellationToken ct = default
    ) => throw new InvalidOperationException("GitHub OAuth is not configured.");
}
