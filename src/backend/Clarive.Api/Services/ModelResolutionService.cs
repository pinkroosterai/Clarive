using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class ModelResolutionService(
    IAiProviderRepository providerRepo,
    IAgentFactory agentFactory,
    IEncryptionService encryption,
    IOptionsMonitor<AiSettings> aiSettings,
    TenantCacheService cache,
    ILogger<ModelResolutionService> logger) : IModelResolutionService
{
    public async Task<ErrorOr<ResolvedModel>> ResolveProviderForModelAsync(string model, CancellationToken ct)
    {
        // Resolve provider for this model (cached)
        var providers = await cache.GetOrCreateGlobalAsync(
            TenantCacheKeys.AiProvidersKey,
            _ => providerRepo.GetAllAsync(ct),
            TenantCacheKeys.AiCacheTtl,
            ct);

        var providerMatch = providers
            .Where(p => p.IsActive)
            .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
            .FirstOrDefault(x => x.Model.IsActive &&
                x.Model.ModelId.Equals(model, StringComparison.OrdinalIgnoreCase));

        // Check model is available: either configured in a provider, or in the legacy model list
        if (providerMatch is null)
        {
            var availableResult = await GetAvailableModelsAsync(ct);
            if (!availableResult.IsError &&
                !availableResult.Value.Contains(model, StringComparer.OrdinalIgnoreCase))
            {
                return Error.Validation("INVALID_MODEL", $"Model '{model}' is not available.");
            }
        }

        IChatClient chatClient;
        var isTemperatureConfigurable = !(providerMatch?.Model.IsReasoning ?? false);
        var apiMode = providerMatch?.Provider.ApiMode ?? Models.Enums.AiApiMode.ResponsesApi;

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
                apiKey, providerMatch.Provider.EndpointUrl, model, apiMode);
        }
        else
        {
            chatClient = agentFactory.CreateChatClient(model);
        }

        return new ResolvedModel(
            chatClient,
            model,
            providerMatch?.Provider.Name ?? "Default",
            isTemperatureConfigurable,
            apiMode);
    }

    public async Task<ErrorOr<List<EnrichedModelResponse>>> GetEnrichedModelsAsync(CancellationToken ct)
    {
        var enriched = await cache.GetOrCreateGlobalAsync(
            TenantCacheKeys.EnrichedModelsKey,
            async _ =>
            {
                var providers = await providerRepo.GetAllAsync(ct);
                var activeProviders = providers.Where(p => p.IsActive).ToList();

                if (activeProviders.Count == 0)
                    return new List<EnrichedModelResponse>();

                return activeProviders
                    .SelectMany(p => p.Models
                        .Where(m => m.IsActive)
                        .Select(m => new EnrichedModelResponse(
                            m.ModelId,
                            m.DisplayName,
                            p.Id,
                            p.Name,
                            m.IsReasoning,
                            m.SupportsFunctionCalling,
                            m.SupportsResponseSchema,
                            m.MaxInputTokens,
                            m.MaxOutputTokens,
                            m.DefaultTemperature,
                            m.DefaultMaxTokens,
                            m.DefaultReasoningEffort
                        )))
                    .ToList();
            },
            TenantCacheKeys.AiCacheTtl,
            ct);

        return enriched;
    }

    public async Task<ErrorOr<List<string>>> GetAvailableModelsAsync(CancellationToken ct)
    {
        // Don't use GetOrCreateGlobalAsync — we must NOT cache error results.
        // Transient OpenAI failures should not be cached for 5 minutes.
        try
        {
            var cached = await cache.GetOrCreateGlobalAsync(
                TenantCacheKeys.AvailableModelsKey,
                async _ =>
                {
                    using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    cts.CancelAfter(TimeSpan.FromSeconds(10));

                    var client = agentFactory.GetOpenAIClient();
                    var modelClient = client.GetOpenAIModelClient();
                    var response = await modelClient.GetModelsAsync(cts.Token);

                    var result = response.Value
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
                        result = result.Where(m => whitelist.Contains(m)).ToList();
                    }

                    return result;
                },
                TenantCacheKeys.AiCacheTtl,
                ct);

            return cached;
        }
        catch (OperationCanceledException)
        {
            return Error.Failure("MODEL_FETCH_TIMEOUT", "Connection timed out fetching models.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch available models");
            return Error.Failure("MODEL_FETCH_FAILED", ex.Message);
        }
    }
}
