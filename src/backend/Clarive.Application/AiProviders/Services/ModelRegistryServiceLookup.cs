using System.Collections.Concurrent;
using Clarive.Domain.Interfaces.Services;
using ModelCatalog.Client;
using ModelCatalog.Client.Dtos;

namespace Clarive.Application.AiProviders.Services;

public sealed class ModelRegistryServiceLookup(IModelCatalogClient client) : IModelRegistryLookup
{
    private readonly ConcurrentDictionary<string, bool> _nonChatCache = new(
        StringComparer.OrdinalIgnoreCase
    );

    public async Task<LiteLlmModelInfo?> TryGetModelInfoAsync(
        string providerName,
        string modelId,
        CancellationToken ct = default
    )
    {
        var info = await client.GetModelAsync(providerName, modelId, ct).ConfigureAwait(false);
        if (info is null)
            return null;

        var key = $"{providerName.ToLowerInvariant()}/{modelId}";
        _nonChatCache[key] = info.Modality != Modality.Chat;

        return new LiteLlmModelInfo(
            InputCostPerMillion: info.Pricing?.InputCostPerMillion,
            OutputCostPerMillion: info.Pricing?.OutputCostPerMillion,
            MaxInputTokens: info.Context?.MaxInputTokens,
            MaxOutputTokens: info.Context?.MaxOutputTokens,
            IsReasoning: info.Capabilities.IsReasoning,
            SupportsFunctionCalling: info.Capabilities.SupportsFunctionCalling,
            SupportsResponseSchema: info.Capabilities.SupportsResponseSchema
        );
    }

    public bool IsKnownNonChatModel(string providerName, string modelId) =>
        _nonChatCache.TryGetValue($"{providerName.ToLowerInvariant()}/{modelId}", out var nonChat)
        && nonChat;
}
