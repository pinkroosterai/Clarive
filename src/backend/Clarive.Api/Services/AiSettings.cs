namespace Clarive.Api.Services;

public record AiSettings
{
    public string OpenAiApiKey { get; init; } = "";
    public string EndpointUrl { get; init; } = "";
    public string DefaultModel { get; init; } = "gpt-5-mini";
    public string PremiumModel { get; init; } = "gpt-5.2";
    public string TavilyApiKey { get; init; } = "";
}
