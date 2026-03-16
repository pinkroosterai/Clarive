namespace Clarive.Api.Services;

public record AiSettings
{
    public string DefaultModel { get; init; } = "gpt-5-mini";
    public string DefaultModelProviderId { get; init; } = "";
    public string PremiumModel { get; init; } = "gpt-5.2";
    public string PremiumModelProviderId { get; init; } = "";
    public string AllowedModels { get; init; } = "";
    public string TavilyApiKey { get; init; } = "";

    // Role-specific parameter overrides (null = use model default)
    public float? DefaultModelTemperature { get; init; }
    public int? DefaultModelMaxTokens { get; init; }
    public string? DefaultModelReasoningEffort { get; init; }
    public float? PremiumModelTemperature { get; init; }
    public int? PremiumModelMaxTokens { get; init; }
    public string? PremiumModelReasoningEffort { get; init; }
}
