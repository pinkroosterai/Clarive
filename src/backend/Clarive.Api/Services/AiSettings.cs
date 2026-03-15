namespace Clarive.Api.Services;

public record AiSettings
{
    public string DefaultModel { get; init; } = "gpt-5-mini";
    public string DefaultModelProviderId { get; init; } = "";
    public string PremiumModel { get; init; } = "gpt-5.2";
    public string PremiumModelProviderId { get; init; } = "";
    public string TavilyApiKey { get; init; } = "";
}
