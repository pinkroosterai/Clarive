namespace Clarive.Api.Services;

public record GoogleAuthSettings
{
    public string ClientId { get; init; } = "";
    public string ClientSecret { get; init; } = "";
}
