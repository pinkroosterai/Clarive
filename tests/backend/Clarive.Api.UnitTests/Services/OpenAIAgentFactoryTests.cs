using Clarive.AI.Agents;
using Clarive.AI.Configuration;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class OpenAIAgentFactoryTests
{
    private readonly IAiProviderResolver _providerResolver = Substitute.For<IAiProviderResolver>();
    private readonly OpenAIAgentFactory _sut;

    public OpenAIAgentFactoryTests()
    {
        _providerResolver
            .LoadProvidersAsync()
            .Returns(new List<AiProvider>());

        var loggerFactory = Substitute.For<ILoggerFactory>();
        loggerFactory
            .CreateLogger(Arg.Any<string>())
            .Returns(Substitute.For<ILogger<OpenAIAgentFactory>>());

        var settings = new AiSettings();
        var optionsMonitor = Substitute.For<IOptionsMonitor<AiSettings>>();
        optionsMonitor.CurrentValue.Returns(settings);

        _sut = new OpenAIAgentFactory(optionsMonitor, _providerResolver, loggerFactory);
    }

    // ── Issue 121: Sync guard — if this test fails, update CONFIGURABLE_ACTIONS in ActionModelTable.tsx ──

    [Fact]
    public void ConfigurableActions_IncludesAllActionTypesExceptPlaygroundTest()
    {
        // ConfigurableActions is derived from the AiActionType enum, excluding PlaygroundTest.
        // If this test fails after adding a new AiActionType, update CONFIGURABLE_ACTIONS
        // in ActionModelTable.tsx and add a matching ActionAiConfig property to AiSettings.
        var expected = Enum.GetValues<AiActionType>()
            .Where(a => a != AiActionType.PlaygroundTest)
            .ToArray();

        OpenAIAgentFactory
            .ConfigurableActions.Should()
            .BeEquivalentTo(
                expected,
                "ConfigurableActions should include all AiActionType values except PlaygroundTest — update CONFIGURABLE_ACTIONS in ActionModelTable.tsx"
            );
    }

    // ── Issue 122: ReinitializeClientsAsync coverage ──

    [Fact]
    public void Constructor_NoModelsConfigured_IsConfiguredFalse()
    {
        _sut.IsConfigured.Should().BeFalse();
    }

    [Fact]
    public void Constructor_NoModelsConfigured_GetModelInfoReturnsNulls()
    {
        var (modelId, providerName) = _sut.GetModelInfo(AiActionType.Generation);

        modelId.Should().BeNull();
        providerName.Should().BeNull();
    }

    [Fact]
    public void GetModelInfo_PlaygroundTest_ReturnsNulls()
    {
        var (modelId, providerName) = _sut.GetModelInfo(AiActionType.PlaygroundTest);

        modelId.Should().BeNull();
        providerName.Should().BeNull();
    }

    [Fact]
    public void Constructor_AllActionsConfigured_IsConfiguredTrue()
    {
        var factory = CreateFactoryWithAllActionsConfigured();

        factory.IsConfigured.Should().BeTrue();
    }

    [Fact]
    public void Constructor_AllActionsConfigured_GetModelInfoReturnsCorrectValues()
    {
        var factory = CreateFactoryWithAllActionsConfigured();

        foreach (var action in OpenAIAgentFactory.ConfigurableActions)
        {
            var (modelId, providerName) = factory.GetModelInfo(action);
            modelId.Should().Be("gpt-4o", $"{action} should have model gpt-4o");
            providerName.Should().Be("TestProvider", $"{action} should use TestProvider");
        }
    }

    [Fact]
    public void Constructor_OneActionMissingModel_IsConfiguredFalse()
    {
        var settings = new AiSettings
        {
            Generation = new ActionAiConfig { Model = "gpt-4o" },
            Evaluation = new ActionAiConfig { Model = "gpt-4o" },
            Clarification = new ActionAiConfig { Model = "gpt-4o" },
            SystemMessage = new ActionAiConfig { Model = "gpt-4o" },
            Decomposition = new ActionAiConfig { Model = "gpt-4o" },
            FillTemplateFields = new ActionAiConfig { Model = "gpt-4o" },
            // PlaygroundJudge intentionally left empty
        };

        var factory = CreateFactory(settings);

        factory.IsConfigured.Should().BeFalse();
    }

    [Fact]
    public void Constructor_ProviderLoadFails_IsConfiguredFalse()
    {
        var resolver = Substitute.For<IAiProviderResolver>();
        resolver
            .LoadProvidersAsync()
            .Returns<List<AiProvider>>(_ => throw new Exception("DB down"));

        var factory = CreateFactory(MakeAllActionsSettings(), resolver);

        factory.IsConfigured.Should().BeFalse();
    }

    private OpenAIAgentFactory CreateFactoryWithAllActionsConfigured()
    {
        var settings = MakeAllActionsSettings();

        var resolver = Substitute.For<IAiProviderResolver>();
        resolver
            .LoadProvidersAsync()
            .Returns(new List<AiProvider> { MakeProvider("TestProvider", "gpt-4o") });
        resolver
            .ResolveProviderForModel(Arg.Any<List<AiProvider>>(), Arg.Any<string>(), Arg.Any<string?>())
            .Returns(callInfo => new ResolvedProvider(
                "decrypted-api-key",
                "https://api.openai.com/v1",
                "TestProvider",
                new AiProviderModel
                {
                    Id = Guid.NewGuid(),
                    ModelId = callInfo.ArgAt<string>(1),
                    IsActive = true,
                    IsReasoning = false,
                    MaxInputTokens = 128000,
                }
            ));

        return CreateFactory(settings, resolver);
    }

    private OpenAIAgentFactory CreateFactory(
        AiSettings settings,
        IAiProviderResolver? resolver = null
    )
    {
        resolver ??= _providerResolver;

        var loggerFactory = Substitute.For<ILoggerFactory>();
        loggerFactory
            .CreateLogger(Arg.Any<string>())
            .Returns(Substitute.For<ILogger<OpenAIAgentFactory>>());

        var optionsMonitor = Substitute.For<IOptionsMonitor<AiSettings>>();
        optionsMonitor.CurrentValue.Returns(settings);

        return new OpenAIAgentFactory(optionsMonitor, resolver, loggerFactory);
    }

    private static AiProvider MakeProvider(string providerName, string modelId) =>
        new()
        {
            Id = Guid.NewGuid(),
            Name = providerName,
            ApiKeyEncrypted = "encrypted-key",
            EndpointUrl = "https://api.openai.com/v1",
            IsActive = true,
            Models =
            [
                new AiProviderModel
                {
                    Id = Guid.NewGuid(),
                    ModelId = modelId,
                    IsActive = true,
                    IsReasoning = false,
                    MaxInputTokens = 128000,
                },
            ],
        };

    private static AiSettings MakeAllActionsSettings() =>
        new()
        {
            Generation = new ActionAiConfig { Model = "gpt-4o" },
            Evaluation = new ActionAiConfig { Model = "gpt-4o" },
            Clarification = new ActionAiConfig { Model = "gpt-4o" },
            SystemMessage = new ActionAiConfig { Model = "gpt-4o" },
            Decomposition = new ActionAiConfig { Model = "gpt-4o" },
            FillTemplateFields = new ActionAiConfig { Model = "gpt-4o" },
            PlaygroundJudge = new ActionAiConfig { Model = "gpt-4o" },
            PolishDescription = new ActionAiConfig { Model = "gpt-4o" },
            MergeConflict = new ActionAiConfig { Model = "gpt-4o" },
        };
}
