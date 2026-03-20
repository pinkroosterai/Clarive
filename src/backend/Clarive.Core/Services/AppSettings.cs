namespace Clarive.Core.Services;

public record AppSettings
{
    public string FrontendUrl { get; init; } = "http://localhost:8080";
}
