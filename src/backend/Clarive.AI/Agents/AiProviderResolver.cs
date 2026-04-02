using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Clarive.AI.Agents;

/// <summary>
/// Resolves AI providers from the database and decrypts their API credentials.
/// Singleton lifetime — used by OpenAIAgentFactory during client initialization.
/// </summary>
public class AiProviderResolver : IAiProviderResolver
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEncryptionService _encryption;
    private readonly ILogger<AiProviderResolver> _logger;

    public AiProviderResolver(
        IServiceScopeFactory scopeFactory,
        IEncryptionService encryption,
        ILogger<AiProviderResolver> logger
    )
    {
        _scopeFactory = scopeFactory;
        _encryption = encryption;
        _logger = logger;
    }

    public async Task<List<AiProvider>> LoadProvidersAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IAiProviderRepository>();
        return await repo.GetAllAsync();
    }

    public ResolvedProvider? ResolveProviderForModel(
        List<AiProvider> providers,
        string modelId,
        string? providerId = null
    )
    {
        var activeProviders = providers.Where(p => p.IsActive);

        // When a provider ID is specified, filter to that provider first
        if (!string.IsNullOrWhiteSpace(providerId) && Guid.TryParse(providerId, out var pid))
            activeProviders = activeProviders.Where(p => p.Id == pid);

        var match = activeProviders
            .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
            .FirstOrDefault(x =>
                x.Model.IsActive
                && x.Model.ModelId.Equals(modelId, StringComparison.OrdinalIgnoreCase)
            );

        if (match is null || !_encryption.IsAvailable)
            return null;

        string apiKey;
        try
        {
            apiKey = _encryption.Decrypt(match.Provider.ApiKeyEncrypted);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to decrypt API key for provider {ProviderName} (model {ModelId}) — treating as unconfigured",
                match.Provider.Name,
                modelId
            );
            return null;
        }
        return new ResolvedProvider(
            apiKey,
            match.Provider.EndpointUrl,
            match.Provider.Name,
            match.Provider.CustomHeaders,
            match.Model
        );
    }
}
