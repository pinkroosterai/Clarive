namespace Clarive.Api.Services.Interfaces;

public record LiteLlmModelInfo(
    decimal? InputCostPerMillion,
    decimal? OutputCostPerMillion,
    long? MaxInputTokens,
    long? MaxOutputTokens,
    bool? IsReasoning,
    bool? SupportsFunctionCalling,
    bool? SupportsResponseSchema
);

public interface ILiteLlmRegistryCache
{
    Task<LiteLlmModelInfo?> TryGetModelInfoAsync(string providerName, string modelId, CancellationToken ct = default);
    Task LoadFromJsonAsync(string json, CancellationToken ct = default);
    Task LoadFromFileAsync(string path, CancellationToken ct = default);
    Task SaveToFileAsync(string path, string rawJson, CancellationToken ct = default);
    Task<bool> IsLoadedAsync(CancellationToken ct = default);
}
