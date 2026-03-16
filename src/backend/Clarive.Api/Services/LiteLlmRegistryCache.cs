using System.Text.Json;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace Clarive.Api.Services;

public class LiteLlmRegistryCache(IMemoryCache cache, ILogger<LiteLlmRegistryCache> logger) : ILiteLlmRegistryCache
{
    private const string CacheKey = "litellm_model_registry";
    private const decimal PerTokenToPerMillion = 1_000_000m;

    public bool IsLoaded => cache.TryGetValue(CacheKey, out _);

    public LiteLlmModelInfo? TryGetModelInfo(string providerName, string modelId)
    {
        if (!cache.TryGetValue(CacheKey, out Dictionary<string, LiteLlmModelInfo>? registry) || registry is null)
            return null;

        // Try exact match: "provider/model-id"
        var key = $"{providerName.ToLowerInvariant()}/{modelId}";
        if (registry.TryGetValue(key, out var info))
            return info;

        // Try model-only fallback (some models have no provider prefix)
        if (registry.TryGetValue(modelId, out info))
            return info;

        return null;
    }

    public void LoadFromJson(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var registry = new Dictionary<string, LiteLlmModelInfo>(StringComparer.OrdinalIgnoreCase);
        var skipped = 0;

        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Object)
                continue;

            try
            {
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

        cache.Set(CacheKey, registry, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(25),
            Size = 1
        });

        logger.LogInformation("Loaded {Count} models into LiteLLM registry cache (skipped {Skipped})",
            registry.Count, skipped);
    }

    public async Task LoadFromFileAsync(string path, CancellationToken ct = default)
    {
        if (!File.Exists(path))
            return;

        var json = await File.ReadAllTextAsync(path, ct);
        LoadFromJson(json);
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

        // Convert per-token to per-million
        return new LiteLlmModelInfo(
            InputCostPerMillion: inputCost.HasValue ? inputCost.Value * PerTokenToPerMillion : null,
            OutputCostPerMillion: outputCost.HasValue ? outputCost.Value * PerTokenToPerMillion : null,
            MaxInputTokens: maxInputTokens,
            MaxOutputTokens: maxOutputTokens,
            IsReasoning: isReasoning
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

    /// <summary>
    /// Reads a numeric JSON property as long. Handles plain integers, large numbers,
    /// and scientific notation (e.g., 2e5) by parsing as double first.
    /// </summary>
    private static long? GetLongProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return null;

        if (prop.ValueKind != JsonValueKind.Number)
            return null;

        // TryGetInt64 handles plain integer values efficiently
        if (prop.TryGetInt64(out var longValue))
            return longValue;

        // Fall back to double for scientific notation (e.g., 1.048576e6)
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
