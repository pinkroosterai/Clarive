using Clarive.Application.AiProviders.Services;
using Clarive.ModelRegistry.Client;
using Clarive.ModelRegistry.Client.Dtos;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace Clarive.Api.UnitTests.Services;

public class ModelRegistryServiceLookupTests
{
    [Fact]
    public async Task TryGetModelInfoAsync_MapsFromSdkDto()
    {
        var client = Substitute.For<IModelCatalogClient>();
        client
            .GetModelAsync("openai", "gpt-5", Arg.Any<CancellationToken>())
            .Returns(
                new ModelInfo(
                    "openai/gpt-5",
                    "openai",
                    "gpt-5",
                    "GPT-5",
                    new Pricing(2.5m, 10m, null, null, "USD"),
                    new Context(400000, 128000),
                    new Capabilities(false, true, true, null, null),
                    Modality.Chat,
                    new[] { "litellm" },
                    DateTimeOffset.UnixEpoch
                )
            );
        var sut = new ModelRegistryServiceLookup(client);

        var info = await sut.TryGetModelInfoAsync("openai", "gpt-5");

        info.Should().NotBeNull();
        info!.InputCostPerMillion.Should().Be(2.5m);
        info.OutputCostPerMillion.Should().Be(10m);
        info.MaxInputTokens.Should().Be(400000);
        info.MaxOutputTokens.Should().Be(128000);
        info.IsReasoning.Should().BeFalse();
        info.SupportsFunctionCalling.Should().BeTrue();
        info.SupportsResponseSchema.Should().BeTrue();
    }

    [Fact]
    public async Task TryGetModelInfoAsync_ReturnsNullForMissingModel()
    {
        var client = Substitute.For<IModelCatalogClient>();
        client
            .GetModelAsync("openai", "nope", Arg.Any<CancellationToken>())
            .Returns((ModelInfo?)null);
        var sut = new ModelRegistryServiceLookup(client);

        (await sut.TryGetModelInfoAsync("openai", "nope")).Should().BeNull();
    }

    [Fact]
    public async Task IsKnownNonChatModel_ReflectsCachedModality()
    {
        var client = Substitute.For<IModelCatalogClient>();
        client
            .GetModelAsync("openai", "text-embedding-3-small", Arg.Any<CancellationToken>())
            .Returns(
                new ModelInfo(
                    "openai/text-embedding-3-small",
                    "openai",
                    "text-embedding-3-small",
                    null,
                    null,
                    null,
                    new Capabilities(null, null, null, null, null),
                    Modality.Embedding,
                    new[] { "litellm" },
                    DateTimeOffset.UnixEpoch
                )
            );
        var sut = new ModelRegistryServiceLookup(client);

        await sut.TryGetModelInfoAsync("openai", "text-embedding-3-small");

        sut.IsKnownNonChatModel("openai", "text-embedding-3-small").Should().BeTrue();
    }
}
