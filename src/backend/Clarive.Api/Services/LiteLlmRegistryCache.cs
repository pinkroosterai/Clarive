using System.Text.Json;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Distributed;

namespace Clarive.Api.Services;

public class LiteLlmRegistryCache(IDistributedCache cache, ILogger<LiteLlmRegistryCache> logger) : ILiteLlmRegistryCache
{
    private const string CacheKey = "clarive:global:litellm_model_registry";
    private const decimal PerTokenToPerMillion = 1_000_000m;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(25);

    // In-memory deserialized registry to avoid repeated JSON parsing
    // Refreshed when LoadFromJsonAsync is called or when cache read detects a change
    private volatile Dictionary<string, LiteLlmModelInfo>? _localRegistry;
    private volatile HashSet<string>? _nonChatModels;

    public async Task<bool> IsLoadedAsync(CancellationToken ct = default)
    {
        try
        {
            var data = await cache.GetStringAsync(CacheKey, ct);
            return data is not null;
        }
        catch (OperationCanceledException) { throw; }
        catch
        {
            return false;
        }
    }

    public async Task<LiteLlmModelInfo?> TryGetModelInfoAsync(string providerName, string modelId, CancellationToken ct = default)
    {
        try
        {
            var registry = _localRegistry;
            if (registry is null)
            {
                var json = await cache.GetStringAsync(CacheKey, ct);
                if (json is null)
                    return null;

                registry = JsonSerializer.Deserialize<Dictionary<string, LiteLlmModelInfo>>(json);
                _localRegistry = registry;
            }

            if (registry is null)
                return null;

            // Try exact match: "provider/model-id"
            var key = $"{providerName.ToLowerInvariant()}/{modelId}";
            if (registry.TryGetValue(key, out var info))
                return info;

            // Try model-only fallback (some models have no provider prefix)
            if (registry.TryGetValue(modelId, out info))
                return info;
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to read LiteLLM registry from cache");
        }

        return null;
    }

    public bool IsKnownNonChatModel(string providerName, string modelId)
    {
        var nonChat = _nonChatModels;
        if (nonChat is null) return false;

        var key = $"{providerName.ToLowerInvariant()}/{modelId}";
        return nonChat.Contains(key) || nonChat.Contains(modelId);
    }

    public async Task LoadFromJsonAsync(string json, CancellationToken ct = default)
    {
        using var doc = JsonDocument.Parse(json);
        var registry = new Dictionary<string, LiteLlmModelInfo>(StringComparer.OrdinalIgnoreCase);
        var nonChat = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var skipped = 0;

        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Object)
                continue;

            try
            {
                // Track non-chat models so callers can filter them out
                if (prop.Value.TryGetProperty("mode", out var modeEl) &&
                    modeEl.GetString() is string modeStr && modeStr != "chat")
                {
                    nonChat.Add(prop.Name);
                }

                var entry = ParseEntry(prop.Value);
                if (entry is not null)
                    registry[prop.Name] = entry;
            }
            catch (Exception ex)
            {
                skipped++;
                logger.LogWarning(ex, "Failed to parse LiteLLM model entry '{ModelKey}', skipping", prop.Name);
            }
        }

        try
        {
            var serialized = JsonSerializer.Serialize(registry);
            await cache.SetStringAsync(CacheKey, serialized, new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = CacheTtl
            }, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to store LiteLLM registry in distributed cache");
        }

        // Update local in-memory copies
        _localRegistry = registry;
        _nonChatModels = nonChat;

        logger.LogInformation("Loaded {Count} models into LiteLLM registry cache (skipped {Skipped})",
            registry.Count, skipped);
    }

    public async Task LoadFromFileAsync(string path, CancellationToken ct = default)
    {
        if (!File.Exists(path))
            return;

        var json = await File.ReadAllTextAsync(path, ct);
        await LoadFromJsonAsync(json, ct);
    }

    public async Task SaveToFileAsync(string path, string rawJson, CancellationToken ct = default)
    {
        var dir = Path.GetDirectoryName(path);
        if (dir is not null && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        await File.WriteAllTextAsync(path, rawJson, ct);
    }

    private static LiteLlmModelInfo? ParseEntry(JsonElement element)
    {
        // Only include chat models (skip embeddings, image generation, etc.)
        if (element.TryGetProperty("mode", out var mode) &&
            mode.GetString() is string m && m != "chat")
            return null;

        decimal? inputCost = GetDecimalProperty(element, "input_cost_per_token");
        decimal? outputCost = GetDecimalProperty(element, "output_cost_per_token");
        long? maxInputTokens = GetLongProperty(element, "max_input_tokens");
        long? maxOutputTokens = GetLongProperty(element, "max_output_tokens");
        bool? isReasoning = GetBoolProperty(element, "supports_reasoning");
        bool? supportsFunctionCalling = GetBoolProperty(element, "supports_function_calling");
        bool? supportsResponseSchema = GetBoolProperty(element, "supports_response_schema");

        // Convert per-token to per-million
        return new LiteLlmModelInfo(
            InputCostPerMillion: inputCost.HasValue ? inputCost.Value * PerTokenToPerMillion : null,
            OutputCostPerMillion: outputCost.HasValue ? outputCost.Value * PerTokenToPerMillion : null,
            MaxInputTokens: maxInputTokens,
            MaxOutputTokens: maxOutputTokens,
            IsReasoning: isReasoning,
            SupportsFunctionCalling: supportsFunctionCalling,
            SupportsResponseSchema: supportsResponseSchema
        );
    }

    private static decimal? GetDecimalProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return null;

        if (prop.ValueKind != JsonValueKind.Number)
            return null;

        return prop.GetDecimal();
    }

    private static long? GetLongProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return null;

        if (prop.ValueKind != JsonValueKind.Number)
            return null;

        if (prop.TryGetInt64(out var longValue))
            return longValue;

        if (prop.TryGetDouble(out var doubleValue))
            return (long)doubleValue;

        return null;
    }

    private static bool? GetBoolProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return null;

        return prop.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }
}
