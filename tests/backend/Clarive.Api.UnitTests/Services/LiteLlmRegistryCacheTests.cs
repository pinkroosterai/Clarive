using System.Text;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class LiteLlmRegistryCacheTests
{
    private readonly IDistributedCache _distributedCache = Substitute.For<IDistributedCache>();
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
            "supports_function_calling": true,
            "supports_response_schema": true,
            "litellm_provider": "openai"
        },
        "anthropic/claude-3-5-sonnet": {
            "input_cost_per_token": 0.000003,
            "output_cost_per_token": 0.000015,
            "max_input_tokens": 200000,
            "max_output_tokens": 8192,
            "mode": "chat",
            "supports_reasoning": false,
            "supports_function_calling": true,
            "supports_response_schema": false,
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
        // Capture what's written to the distributed cache so reads return it
        byte[]? stored = null;
        _distributedCache.SetAsync(
            Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<DistributedCacheEntryOptions>(), Arg.Any<CancellationToken>())
            .Returns(ci => { stored = ci.ArgAt<byte[]>(1); return Task.CompletedTask; });
        _distributedCache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(_ => stored);

        _cache = new LiteLlmRegistryCache(_distributedCache, NullLogger<LiteLlmRegistryCache>.Instance);
        _cache.LoadFromJsonAsync(TestJson).GetAwaiter().GetResult();
    }

    [Fact]
    public async Task ExactMatch_ReturnsCorrectCosts()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(2.5m, info.InputCostPerMillion);
        Assert.Equal(10m, info.OutputCostPerMillion);
        Assert.Equal(128000L, info.MaxInputTokens);
        Assert.Equal(16384L, info.MaxOutputTokens);
    }

    [Fact]
    public async Task ExactMatch_Anthropic_ReturnsCorrectValues()
    {
        var info = await _cache.TryGetModelInfoAsync("anthropic", "claude-3-5-sonnet");

        Assert.NotNull(info);
        Assert.Equal(3m, info.InputCostPerMillion);
        Assert.Equal(15m, info.OutputCostPerMillion);
        Assert.Equal(200000, info.MaxInputTokens);
        Assert.Equal(8192, info.MaxOutputTokens);
    }

    [Fact]
    public async Task ModelOnlyFallback_WhenProviderDoesNotMatchPrefix()
    {
        var info = await _cache.TryGetModelInfoAsync("SomeProvider", "gpt-4o-mini");

        Assert.NotNull(info);
        Assert.Equal(0.15m, info.InputCostPerMillion);
        Assert.Equal(0.6m, info.OutputCostPerMillion);
    }

    [Fact]
    public async Task CostConversion_PerTokenToPerMillion()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(0.0000025m * 1_000_000m, info.InputCostPerMillion);
        Assert.Equal(0.00001m * 1_000_000m, info.OutputCostPerMillion);
    }

    [Fact]
    public async Task MissingCostFields_ReturnsNullForCosts()
    {
        var info = await _cache.TryGetModelInfoAsync("custom", "no-cost-model");

        Assert.NotNull(info);
        Assert.Null(info.InputCostPerMillion);
        Assert.Null(info.OutputCostPerMillion);
        Assert.Equal(32000L, info.MaxInputTokens);
        Assert.Equal(4096L, info.MaxOutputTokens);
    }

    [Fact]
    public async Task UnknownModel_ReturnsNull()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "nonexistent-model");

        Assert.Null(info);
    }

    [Fact]
    public async Task EmbeddingModels_AreExcluded()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "text-embedding-3-small");

        Assert.Null(info);
    }

    [Fact]
    public async Task CaseInsensitiveProviderMatching()
    {
        var info = await _cache.TryGetModelInfoAsync("OpenAI", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(2.5m, info.InputCostPerMillion);
    }

    [Fact]
    public async Task IsLoadedAsync_ReturnsTrueAfterLoad()
    {
        Assert.True(await _cache.IsLoadedAsync());
    }

    [Fact]
    public async Task IsLoadedAsync_ReturnsFalseBeforeLoad()
    {
        var emptyDistributed = Substitute.For<IDistributedCache>();
        emptyDistributed.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);
        var cache = new LiteLlmRegistryCache(emptyDistributed, NullLogger<LiteLlmRegistryCache>.Instance);

        Assert.False(await cache.IsLoadedAsync());
    }

    [Fact]
    public async Task MaxTokenFields_MappedCorrectly()
    {
        var info = await _cache.TryGetModelInfoAsync("anthropic", "claude-3-5-sonnet");

        Assert.NotNull(info);
        Assert.Equal(200000L, info.MaxInputTokens);
        Assert.Equal(8192L, info.MaxOutputTokens);
    }

    [Fact]
    public async Task ScientificNotation_MaxTokens_ParsedCorrectly()
    {
        var info = await _cache.TryGetModelInfoAsync("custom", "sci-notation-model");

        Assert.NotNull(info);
        Assert.Equal(200_000L, info.MaxInputTokens);
        Assert.Equal(4096L, info.MaxOutputTokens);
    }

    [Fact]
    public async Task ScientificNotation_CostFields_ParsedCorrectly()
    {
        var info = await _cache.TryGetModelInfoAsync("gemini", "gemini-2.5-flash");

        Assert.NotNull(info);
        Assert.Equal(0.15m, info.InputCostPerMillion);
        Assert.Equal(0.6m, info.OutputCostPerMillion);
        Assert.Equal(1_048_576L, info.MaxInputTokens);
        Assert.Equal(65535L, info.MaxOutputTokens);
    }

    [Fact]
    public async Task LargeContextWindow_HandledAsLong()
    {
        var info = await _cache.TryGetModelInfoAsync("gemini", "gemini-2.5-flash");

        Assert.NotNull(info);
        Assert.Equal(1_048_576L, info.MaxInputTokens);
    }

    [Fact]
    public async Task SupportsReasoning_True_Parsed()
    {
        var info = await _cache.TryGetModelInfoAsync("gemini", "gemini-2.5-flash");

        Assert.NotNull(info);
        Assert.Equal(true, info.IsReasoning);
    }

    [Fact]
    public async Task SupportsReasoning_False_Parsed()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(false, info.IsReasoning);
    }

    [Fact]
    public async Task SupportsReasoning_Missing_ReturnsNull()
    {
        var info = await _cache.TryGetModelInfoAsync("custom", "no-cost-model");

        Assert.NotNull(info);
        Assert.Null(info.IsReasoning);
    }

    [Fact]
    public async Task SupportsFunctionCalling_True_Parsed()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(true, info.SupportsFunctionCalling);
    }

    [Fact]
    public async Task SupportsResponseSchema_True_Parsed()
    {
        var info = await _cache.TryGetModelInfoAsync("openai", "gpt-4o");

        Assert.NotNull(info);
        Assert.Equal(true, info.SupportsResponseSchema);
    }

    [Fact]
    public async Task SupportsResponseSchema_False_Parsed()
    {
        var info = await _cache.TryGetModelInfoAsync("anthropic", "claude-3-5-sonnet");

        Assert.NotNull(info);
        Assert.Equal(true, info.SupportsFunctionCalling);
        Assert.Equal(false, info.SupportsResponseSchema);
    }

    [Fact]
    public async Task CapabilityFlags_Missing_ReturnsNull()
    {
        var info = await _cache.TryGetModelInfoAsync("custom", "no-cost-model");

        Assert.NotNull(info);
        Assert.Null(info.SupportsFunctionCalling);
        Assert.Null(info.SupportsResponseSchema);
    }
}
