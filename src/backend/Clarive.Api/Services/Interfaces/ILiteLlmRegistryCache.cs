namespace Clarive.Api.Services.Interfaces;

public record LiteLlmModelInfo(
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion,
    long? MaxInputTokens,
    long? MaxOutputTokens,
    bool? IsReasoning
);

public interface ILiteLlmRegistryCache
{
    LiteLlmModelInfo? TryGetModelInfo(string providerName, string modelId);
    void LoadFromJson(string json);
    Task LoadFromFileAsync(string path, CancellationToken ct = default);
    Task SaveToFileAsync(string path, string rawJson, CancellationToken ct = default);
    bool IsLoaded { get; }
}
