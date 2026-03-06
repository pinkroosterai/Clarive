namespace Clarive.Api.Services;

public record AppSettings
{
    public string FrontendUrl { get; init; } = "http://localhost:8080";
}
