namespace Clarive.Api.Services;

public record EmailSettings
{
    public string Provider { get; init; } = "none";
    public string ApiKey { get; init; } = "";
    public string FromAddress { get; init; } = "noreply@clarive.dev";
    public string FromName { get; init; } = "Clarive";
}
