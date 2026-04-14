using Clarive.Domain.Interfaces.Services;

namespace Clarive.Application.AiProviders.Contracts;

public interface IModelRegistryLookup
{
    Task<LiteLlmModelInfo?> TryGetModelInfoAsync(
        string providerName,
        string modelId,
        CancellationToken ct = default
    );
    bool IsKnownNonChatModel(string providerName, string modelId);
}
