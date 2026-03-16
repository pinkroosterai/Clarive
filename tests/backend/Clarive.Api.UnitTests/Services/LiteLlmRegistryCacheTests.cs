using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace Clarive.Api.UnitTests.Services;

public class LiteLlmRegistryCacheTests
{
    private readonly LiteLlmRegistryCache _cache;

    private const string TestJson = """
    {
        "openai/gpt-4o": {
            "input_cost_per_token": 0.0000025,
            "output_cost_per_token": 0.00001,
            "max_input_tokens": 128000,
            "max_output_tokens": 16384,
            "mode": "chat",
            "supports_reasoning": false,
            "litellm_provider": "openai"
        },
        "anthropic/claude-3-5-sonnet": {
            "input_cost_per_token": 0.000003,
            "output_cost_per_token": 0.000015,
            "max_input_tokens": 200000,
            "max_output_tokens": 8192,
            "mode": "chat",
            "supports_reasoning": false,
            "litellm_provider": "anthropic"
        },
        "text-embedding-3-small": {
            "input_cost_per_token": 0.00000002,
            "max_input_tokens": 8191,
            "mode": "embedding",
            "litellm_provider": "openai"
        },
        "no-cost-model": {
            "max_input_tokens": 32000,
            "max_output_tokens": 4096,
            "mode": "chat",
            "litellm_provider": "custom"
        },
        "gpt-4o-mini": {
            "input_cost_per_token": 0.00000015,
            "output_cost_per_token": 0.0000006,
            "max_input_tokens": 128000,
            "max_output_tokens": 16384,
            "mode": "chat",
            "litellm_provider": "openai"
        },
        "gemini/gemini-2.5-flash": {
            "input_cost_per_token": 1.5e-07,
            "output_cost_per_token": 6e-07,
            "max_input_tokens": 1048576,
            "max_output_tokens": 65535,
            "mode": "chat",
            "supports_reasoning": true,
            "litellm_provider": "gemini"
        },
        "custom/sci-notation-model": {
            "input_cost_per_token": 1e-06,
            "output_cost_per_token": 2e-06,
            "max_input_tokens": 2e5,
            "max_output_tokens": 4096,
            "mode": "chat",
            "litellm_provider": "custom"
        }
    }
    """;

    public LiteLlmRegistryCacheTests()
    {
        var memoryCache = new MemoryCache(new MemoryCacheOptions());
        _cache = new LiteLlmRegistryCache(memoryCache, NullLogger<LiteLlmRegistryCache>.Instance);
        _cache.LoadFromJson(TestJson);
    }

    [Fact]
    public void ExactMatch_ReturnsCorrectCosts()
    {
        var info = _cache.TryGetModelInfo("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(2.5m, info.InputCostPerMillion);
        Assert.Equal(10m, info.OutputCostPerMillion);
        Assert.Equal(128000L, info.MaxInputTokens);
        Assert.Equal(16384L, info.MaxOutputTokens);
    }

    [Fact]
    public void ExactMatch_Anthropic_ReturnsCorrectValues()
    {
        var info = _cache.TryGetModelInfo("anthropic", "claude-3-5-sonnet");

        Assert.NotNull(info);
        Assert.Equal(3m, info.InputCostPerMillion);
        Assert.Equal(15m, info.OutputCostPerMillion);
        Assert.Equal(200000, info.MaxInputTokens);
        Assert.Equal(8192, info.MaxOutputTokens);
    }

    [Fact]
    public void ModelOnlyFallback_WhenProviderDoesNotMatchPrefix()
    {
        // "gpt-4o-mini" exists as a top-level key without prefix
        var info = _cache.TryGetModelInfo("SomeProvider", "gpt-4o-mini");

        Assert.NotNull(info);
        Assert.Equal(0.15m, info.InputCostPerMillion);
        Assert.Equal(0.6m, info.OutputCostPerMillion);
    }

    [Fact]
    public void CostConversion_PerTokenToPerMillion()
    {
        // 2.5e-06 per token = 2.5 per million
        var info = _cache.TryGetModelInfo("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(0.0000025m * 1_000_000m, info.InputCostPerMillion);
        Assert.Equal(0.00001m * 1_000_000m, info.OutputCostPerMillion);
    }

    [Fact]
    public void MissingCostFields_ReturnsNullForCosts()
    {
        var info = _cache.TryGetModelInfo("custom", "no-cost-model");

        Assert.NotNull(info);
        Assert.Null(info.InputCostPerMillion);
        Assert.Null(info.OutputCostPerMillion);
        Assert.Equal(32000L, info.MaxInputTokens);
        Assert.Equal(4096L, info.MaxOutputTokens);
    }

    [Fact]
    public void UnknownModel_ReturnsNull()
    {
        var info = _cache.TryGetModelInfo("openai", "nonexistent-model");

        Assert.Null(info);
    }

    [Fact]
    public void EmbeddingModels_AreExcluded()
    {
        // "text-embedding-3-small" has mode: "embedding" — should be filtered out
        var info = _cache.TryGetModelInfo("openai", "text-embedding-3-small");

        Assert.Null(info);
    }

    [Fact]
    public void CaseInsensitiveProviderMatching()
    {
        var info = _cache.TryGetModelInfo("OpenAI", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(2.5m, info.InputCostPerMillion);
    }

    [Fact]
    public void IsLoaded_ReturnsTrueAfterLoad()
    {
        Assert.True(_cache.IsLoaded);
    }

    [Fact]
    public void IsLoaded_ReturnsFalseBeforeLoad()
    {
        var emptyCache = new MemoryCache(new MemoryCacheOptions());
        var cache = new LiteLlmRegistryCache(emptyCache, NullLogger<LiteLlmRegistryCache>.Instance);

        Assert.False(cache.IsLoaded);
    }

    [Fact]
    public void MaxTokenFields_MappedCorrectly()
    {
        var info = _cache.TryGetModelInfo("anthropic", "claude-3-5-sonnet");

        Assert.NotNull(info);
        Assert.Equal(200000L, info.MaxInputTokens);
        Assert.Equal(8192L, info.MaxOutputTokens);
    }

    [Fact]
    public void ScientificNotation_MaxTokens_ParsedCorrectly()
    {
        // "max_input_tokens": 2e5 should parse as 200000
        var info = _cache.TryGetModelInfo("custom", "sci-notation-model");

        Assert.NotNull(info);
        Assert.Equal(200_000L, info.MaxInputTokens);
        Assert.Equal(4096L, info.MaxOutputTokens);
    }

    [Fact]
    public void ScientificNotation_CostFields_ParsedCorrectly()
    {
        // 1.5e-07 per token = 0.15 per million
        var info = _cache.TryGetModelInfo("gemini", "gemini-2.5-flash");

        Assert.NotNull(info);
        Assert.Equal(0.15m, info.InputCostPerMillion);
        Assert.Equal(0.6m, info.OutputCostPerMillion);
        Assert.Equal(1_048_576L, info.MaxInputTokens);
        Assert.Equal(65535L, info.MaxOutputTokens);
    }

    [Fact]
    public void LargeContextWindow_HandledAsLong()
    {
        var info = _cache.TryGetModelInfo("gemini", "gemini-2.5-flash");

        Assert.NotNull(info);
        Assert.Equal(1_048_576L, info.MaxInputTokens);
    }

    [Fact]
    public void SupportsReasoning_True_Parsed()
    {
        var info = _cache.TryGetModelInfo("gemini", "gemini-2.5-flash");

        Assert.NotNull(info);
        Assert.Equal(true, info.IsReasoning);
    }

    [Fact]
    public void SupportsReasoning_False_Parsed()
    {
        var info = _cache.TryGetModelInfo("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(false, info.IsReasoning);
    }

    [Fact]
    public void SupportsReasoning_Missing_ReturnsNull()
    {
        // no-cost-model has no supports_reasoning field
        var info = _cache.TryGetModelInfo("custom", "no-cost-model");

        Assert.NotNull(info);
        Assert.Null(info.IsReasoning);
    }
}
