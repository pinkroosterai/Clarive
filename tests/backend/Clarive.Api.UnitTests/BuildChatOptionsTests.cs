using Clarive.AI.Pipeline;
using Clarive.Domain.Entities;
using FluentAssertions;
using Microsoft.Extensions.AI;
using Xunit;

namespace Clarive.Api.UnitTests;

public class BuildChatOptionsTests
{
    [Fact]
    public void NullModel_ReturnsNull()
    {
        var result = ChatOptionsBuilder.BuildChatOptions(null);
        result.Should().BeNull();
    }

    [Fact]
    public void AllDefaultsNull_ReturnsNull()
    {
        var model = new AiProviderModel { ModelId = "gpt-4o", IsReasoning = false };

        var result = ChatOptionsBuilder.BuildChatOptions(model);
        result.Should().BeNull();
    }

    [Fact]
    public void TemperatureSet_OnConfigurableModel_SetsTemperature()
    {
        var model = new AiProviderModel { ModelId = "gpt-4o", DefaultTemperature = 0.7f };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        result.Should().NotBeNull();
        result!.Temperature.Should().BeApproximately(0.7f, 0.01f);
    }

    [Fact]
    public void TemperatureSet_OnNonConfigurableModel_SkipsTemperature()
    {
        var model = new AiProviderModel
        {
            ModelId = "o1",
            IsReasoning = true,
            DefaultTemperature = 0.5f,
        };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        // Temperature is set but model doesn't support it — should return null (no other defaults)
        result.Should().BeNull();
    }

    [Fact]
    public void MaxTokensSet_SetsMaxOutputTokens()
    {
        var model = new AiProviderModel { ModelId = "gpt-4o", DefaultMaxTokens = 8192 };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        result.Should().NotBeNull();
        result!.MaxOutputTokens.Should().Be(8192);
    }

    [Fact]
    public void ReasoningEffort_OnReasoningModel_SetsReasoning()
    {
        var model = new AiProviderModel
        {
            ModelId = "o1",
            IsReasoning = true,
            DefaultReasoningEffort = "high",
        };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        result.Should().NotBeNull();
        result!.Reasoning.Should().NotBeNull();
        result.Reasoning!.Effort.Should().Be(ReasoningEffort.High);
    }

    [Fact]
    public void ReasoningEffort_OnNonReasoningModel_SkipsReasoning()
    {
        var model = new AiProviderModel
        {
            ModelId = "gpt-4o",
            IsReasoning = false,
            DefaultReasoningEffort = "high",
        };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        // Non-reasoning model with reasoning effort set — should return null (no other defaults)
        result.Should().BeNull();
    }

    [Fact]
    public void StandardModel_WithTempAndTokens_ReturnsBoth()
    {
        var model = new AiProviderModel
        {
            ModelId = "gpt-4o",
            IsReasoning = false,
            DefaultTemperature = 0.3f,
            DefaultMaxTokens = 16384,
        };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        result.Should().NotBeNull();
        result!.Temperature.Should().BeApproximately(0.3f, 0.01f);
        result.MaxOutputTokens.Should().Be(16384);
        result.Reasoning.Should().BeNull();
    }

    [Fact]
    public void ReasoningModel_WithTokensAndEffort_SkipsTemperature()
    {
        var model = new AiProviderModel
        {
            ModelId = "o1",
            IsReasoning = true,
            DefaultTemperature = 0.3f,
            DefaultMaxTokens = 16384,
            DefaultReasoningEffort = "low",
        };

        var result = ChatOptionsBuilder.BuildChatOptions(model);

        result.Should().NotBeNull();
        result!.Temperature.Should().BeNull();
        result.MaxOutputTokens.Should().Be(16384);
        result.Reasoning.Should().NotBeNull();
        result.Reasoning!.Effort.Should().Be(ReasoningEffort.Low);
    }

    // ── WrapWithRoleOverrides ──

    [Fact]
    public void WrapWithRoleOverrides_AllNull_ReturnsOriginalClient()
    {
        var client = NSubstitute.Substitute.For<IChatClient>();

        var result = ChatOptionsBuilder.WrapWithRoleOverrides(client, null, null, null);

        result.Should().BeSameAs(client);
    }

    [Fact]
    public void WrapWithRoleOverrides_EmptyEffort_ReturnsOriginalClient()
    {
        var client = NSubstitute.Substitute.For<IChatClient>();

        var result = ChatOptionsBuilder.WrapWithRoleOverrides(client, null, null, "");

        result.Should().BeSameAs(client);
    }

    [Fact]
    public void WrapWithRoleOverrides_WithTemperature_WrapsClient()
    {
        var client = NSubstitute.Substitute.For<IChatClient>();

        var result = ChatOptionsBuilder.WrapWithRoleOverrides(client, 0.9f, null, null);

        result.Should().NotBeSameAs(client);
    }

    [Fact]
    public void WrapWithRoleOverrides_WithMaxTokens_WrapsClient()
    {
        var client = NSubstitute.Substitute.For<IChatClient>();

        var result = ChatOptionsBuilder.WrapWithRoleOverrides(client, null, 8192, null);

        result.Should().NotBeSameAs(client);
    }

    [Fact]
    public void WrapWithRoleOverrides_WithReasoningEffort_WrapsClient()
    {
        var client = NSubstitute.Substitute.For<IChatClient>();

        var result = ChatOptionsBuilder.WrapWithRoleOverrides(client, null, null, "high");

        result.Should().NotBeSameAs(client);
    }

    // ── ParseReasoningEffort ──

    [Theory]
    [InlineData("low", ReasoningEffort.Low)]
    [InlineData("medium", ReasoningEffort.Medium)]
    [InlineData("high", ReasoningEffort.High)]
    [InlineData("extra-high", ReasoningEffort.ExtraHigh)]
    [InlineData("extrahigh", ReasoningEffort.ExtraHigh)]
    [InlineData("unknown", ReasoningEffort.Medium)]
    [InlineData("LOW", ReasoningEffort.Low)]
    public void ParseReasoningEffort_MapsCorrectly(string input, ReasoningEffort expected)
    {
        var result = ChatOptionsBuilder.ParseReasoningEffort(input);
        result.Should().Be(expected);
    }
}
