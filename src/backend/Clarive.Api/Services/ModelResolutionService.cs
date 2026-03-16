using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class ModelResolutionService(
    IAiProviderRepository providerRepo,
    IAgentFactory agentFactory,
    IEncryptionService encryption,
    IOptionsMonitor<AiSettings> aiSettings,
    IMemoryCache cache,
    ILogger<ModelResolutionService> logger) : IModelResolutionService
{
    private const string ProvidersCacheKey = "ai_providers_all";

    public async Task<ErrorOr<ResolvedModel>> ResolveProviderForModelAsync(string model, CancellationToken ct)
    {
        // Check model is available
        var availableResult = await GetAvailableModelsAsync(ct);
        if (!availableResult.IsError &&
            !availableResult.Value.Contains(model, StringComparer.OrdinalIgnoreCase))
        {
            return Error.Validation("INVALID_MODEL", $"Model '{model}' is not available.");
        }

        // Resolve provider for this model (cached)
        var providers = await cache.GetOrCreateAsync(ProvidersCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            entry.Size = 1;
            return await providerRepo.GetAllAsync(ct);
        }) ?? [];

        var providerMatch = providers
            .Where(p => p.IsActive)
            .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
            .FirstOrDefault(x => x.Model.IsActive &&
                x.Model.ModelId.Equals(model, StringComparison.OrdinalIgnoreCase));

        IChatClient chatClient;
        var isTemperatureConfigurable = providerMatch?.Model.IsTemperatureConfigurable ?? true;

        if (providerMatch is not null && encryption.IsAvailable)
        {
            string apiKey;
            try
            {
                apiKey = encryption.Decrypt(providerMatch.Provider.ApiKeyEncrypted);
            }
            catch (Exception)
            {
                return Error.Failure("DECRYPTION_FAILED",
                    "Failed to decrypt AI provider credentials. Contact your admin.");
            }
            chatClient = agentFactory.CreateChatClientForProvider(
                apiKey, providerMatch.Provider.EndpointUrl, model);
        }
        else
        {
            chatClient = agentFactory.CreateChatClient(model);
        }

        return new ResolvedModel(
            chatClient,
            model,
            providerMatch?.Provider.Name ?? "Default",
            isTemperatureConfigurable);
    }

    public async Task<ErrorOr<List<EnrichedModelResponse>>> GetEnrichedModelsAsync(CancellationToken ct)
    {
        const string cacheKey = "playground_enriched_models";

        if (cache.TryGetValue(cacheKey, out List<EnrichedModelResponse>? cached) && cached is not null)
            return cached;

        var providers = await providerRepo.GetAllAsync(ct);
        var activeProviders = providers.Where(p => p.IsActive).ToList();

        if (activeProviders.Count == 0)
        {
            // Fall back to legacy model list (as simple enriched models with no provider metadata)
            var legacyResult = await GetAvailableModelsAsync(ct);
            if (legacyResult.IsError) return legacyResult.Errors;

            var legacyModels = legacyResult.Value.Select(m => new EnrichedModelResponse(
                m, null, Guid.Empty, "Default", false, 128000, true,
                null, null, null
            )).ToList();

            cache.Set(cacheKey, legacyModels, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                Size = 1
            });
            return legacyModels;
        }

        var enriched = activeProviders
            .SelectMany(p => p.Models
                .Where(m => m.IsActive)
                .Select(m => new EnrichedModelResponse(
                    m.ModelId,
                    m.DisplayName,
                    p.Id,
                    p.Name,
                    m.IsReasoning,
                    m.MaxContextSize,
                    m.IsTemperatureConfigurable,
                    m.DefaultTemperature,
                    m.DefaultMaxTokens,
                    m.DefaultReasoningEffort
                )))
            .ToList();

        cache.Set(cacheKey, enriched, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
            Size = 1
        });
        return enriched;
    }

    public async Task<ErrorOr<List<string>>> GetAvailableModelsAsync(CancellationToken ct)
    {
        const string cacheKey = "playground_available_models";

        if (cache.TryGetValue(cacheKey, out List<string>? cached) && cached is not null)
            return cached;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var client = agentFactory.GetOpenAIClient();
            var modelClient = client.GetOpenAIModelClient();
            var response = await modelClient.GetModelsAsync(cts.Token);

            var models = response.Value
                .Select(m => m.Id)
                .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Filter to admin-whitelisted models if configured
            var allowedModels = aiSettings.CurrentValue.AllowedModels;
            if (!string.IsNullOrWhiteSpace(allowedModels))
            {
                var whitelist = new HashSet<string>(
                    allowedModels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    StringComparer.OrdinalIgnoreCase);
                models = models.Where(m => whitelist.Contains(m)).ToList();
            }

            cache.Set(cacheKey, models, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                Size = 1
            });
            return models;
        }
        catch (OperationCanceledException)
        {
            return Error.Failure("TIMEOUT", "Connection timed out fetching models.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch available models");
            return Error.Failure("MODEL_FETCH_FAILED", ex.Message);
        }
    }
}
