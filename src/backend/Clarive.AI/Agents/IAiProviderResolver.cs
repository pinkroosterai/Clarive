using Clarive.Domain.Entities;

namespace Clarive.AI.Agents;

/// <summary>
/// Resolves AI providers and decrypts their credentials.
/// Extracted from OpenAIAgentFactory to separate infrastructure concerns
/// (database access, encryption) from agent orchestration.
/// </summary>
public interface IAiProviderResolver
{
    Task<List<AiProvider>> LoadProvidersAsync();

    ResolvedProvider? ResolveProviderForModel(
        List<AiProvider> providers,
        string modelId,
        string? providerId = null
    );
}

public record ResolvedProvider(
    string ApiKey,
    string? EndpointUrl,
    string ProviderName,
    Dictionary<string, string>? CustomHeaders,
    AiProviderModel Model
);
