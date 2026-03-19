using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services.Background;

/// <summary>
/// Periodically fetches the LiteLLM model pricing registry from GitHub,
/// caches it locally, and auto-populates NULL cost/context fields on existing models.
/// Runs every 24 hours. On first run, loads from local cache file if available.
/// </summary>
public class LiteLlmSyncService(
    IServiceScopeFactory scopeFactory,
    IHttpClientFactory httpClientFactory,
    ILiteLlmRegistryCache registryCache,
    ILogger<LiteLlmSyncService> logger
) : BackgroundService
{
    // Suppress S1075: URL is a well-known public registry, not a configuration concern
    [System.Diagnostics.CodeAnalysis.SuppressMessage(
        "Design",
        "S1075",
        Justification = "Well-known public registry URL"
    )]
    private const string RegistryUrl =
        "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

    private const string CacheFilePath = "data/litellm-model-prices.json";
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Cold start: load from local cache file immediately
        await LoadFromLocalCacheAsync(ct);

        while (!ct.IsCancellationRequested)
        {
            await FetchAndSyncAsync(ct);
            await Task.Delay(Interval, ct);
        }
    }

    private async Task LoadFromLocalCacheAsync(CancellationToken ct)
    {
        try
        {
            await registryCache.LoadFromFileAsync(CacheFilePath, ct);
            if (await registryCache.IsLoadedAsync(ct))
                logger.LogInformation("Loaded LiteLLM registry from local cache file");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Failed to load LiteLLM registry from local cache");
        }
    }

    private async Task FetchAndSyncAsync(CancellationToken ct)
    {
        try
        {
            // Fetch from GitHub
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);
            var json = await client.GetStringAsync(RegistryUrl, ct);

            // Save to local cache file
            await registryCache.SaveToFileAsync(CacheFilePath, json, ct);

            // Load into memory
            await registryCache.LoadFromJsonAsync(json, ct);

            // Sync existing models
            await SyncExistingModelsAsync(ct);

            logger.LogInformation("LiteLLM registry sync completed");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Failed to sync LiteLLM model registry");
        }
    }

    private async Task SyncExistingModelsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var providerRepo = scope.ServiceProvider.GetRequiredService<IAiProviderRepository>();

        var providers = await providerRepo.GetAllAsync(ct);
        var updated = 0;

        foreach (var provider in providers)
        {
            foreach (var model in provider.Models)
            {
                var info = await registryCache.TryGetModelInfoAsync(
                    provider.Name,
                    model.ModelId,
                    ct
                );
                if (info is null)
                    continue;

                var changed = false;

                // Capability flags always sync (not gated by HasManualCostOverride)
                if (info.IsReasoning is not null && model.IsReasoning != info.IsReasoning.Value)
                {
                    model.IsReasoning = info.IsReasoning.Value;
                    changed = true;
                }
                if (
                    info.SupportsFunctionCalling is not null
                    && model.SupportsFunctionCalling != info.SupportsFunctionCalling.Value
                )
                {
                    model.SupportsFunctionCalling = info.SupportsFunctionCalling.Value;
                    changed = true;
                }
                if (
                    info.SupportsResponseSchema is not null
                    && model.SupportsResponseSchema != info.SupportsResponseSchema.Value
                )
                {
                    model.SupportsResponseSchema = info.SupportsResponseSchema.Value;
                    changed = true;
                }

                // Cost and context fields respect the manual override flag
                if (!model.HasManualCostOverride)
                {
                    if (
                        info.InputCostPerMillion is not null
                        && model.InputCostPerMillion != info.InputCostPerMillion
                    )
                    {
                        model.InputCostPerMillion = info.InputCostPerMillion;
                        changed = true;
                    }
                    if (
                        info.OutputCostPerMillion is not null
                        && model.OutputCostPerMillion != info.OutputCostPerMillion
                    )
                    {
                        model.OutputCostPerMillion = info.OutputCostPerMillion;
                        changed = true;
                    }
                    if (
                        info.MaxInputTokens is not null
                        && model.MaxInputTokens != info.MaxInputTokens
                    )
                    {
                        model.MaxInputTokens = info.MaxInputTokens;
                        changed = true;
                    }
                    if (
                        info.MaxOutputTokens is not null
                        && model.MaxOutputTokens != info.MaxOutputTokens
                    )
                    {
                        model.MaxOutputTokens = info.MaxOutputTokens;
                        changed = true;
                    }
                }

                if (changed)
                {
                    await providerRepo.UpdateModelAsync(model, ct);
                    updated++;
                }
            }
        }

        if (updated > 0)
            logger.LogInformation("Updated {Count} models from LiteLLM registry", updated);
    }
}
