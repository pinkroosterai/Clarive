namespace Clarive.Application.Config.Contracts;

public record AppSettings
{
    public string FrontendUrl { get; init; } = "http://localhost:8080";
}
