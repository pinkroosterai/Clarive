namespace Clarive.Auth.Google;

public record GoogleAuthSettings
{
    public string ClientId { get; init; } = "";
    public string ClientSecret { get; init; } = "";
}
