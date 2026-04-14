using Clarive.Domain.Interfaces.Services;

namespace Clarive.Application.AiProviders.Services;

public sealed class LegacyLiteLlmRegistryLookup(ILiteLlmRegistryCache cache) : IModelRegistryLookup
{
    public Task<LiteLlmModelInfo?> TryGetModelInfoAsync(
        string providerName,
        string modelId,
        CancellationToken ct = default
    ) => cache.TryGetModelInfoAsync(providerName, modelId, ct);

    public bool IsKnownNonChatModel(string providerName, string modelId) =>
        cache.IsKnownNonChatModel(providerName, modelId);
}
