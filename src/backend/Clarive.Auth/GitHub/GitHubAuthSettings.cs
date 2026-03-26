namespace Clarive.Auth.GitHub;

public record GitHubAuthSettings
{
    public string ClientId { get; init; } = "";
    public string ClientSecret { get; init; } = "";
}
