using Clarive.AI.Models;
using Clarive.AI.Extensions;
using Clarive.AI.Agents;
using Clarive.AI.Services;
using Clarive.Infrastructure.Security;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class OpenAIAgentFactoryTests
{
    private readonly IEncryptionService _encryption = Substitute.For<IEncryptionService>();
    private readonly ILogger<OpenAIAgentFactory> _logger;
    private readonly OpenAIAgentFactory _sut;

    public OpenAIAgentFactoryTests()
    {
        _encryption.IsAvailable.Returns(true);

        var providerRepo = Substitute.For<IAiProviderRepository>();
        providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<AiProvider>());

        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(typeof(IAiProviderRepository)).Returns(providerRepo);

        var scope = Substitute.For<IServiceScope>();
        scope.ServiceProvider.Returns(serviceProvider);

        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        scopeFactory.CreateScope().Returns(scope);

        var loggerFactory = Substitute.For<ILoggerFactory>();
        _logger = Substitute.For<ILogger<OpenAIAgentFactory>>();
        loggerFactory.CreateLogger(Arg.Any<string>()).Returns(_logger);

        var settings = new AiSettings();
        var optionsMonitor = Substitute.For<IOptionsMonitor<AiSettings>>();
        optionsMonitor.CurrentValue.Returns(settings);

        _sut = new OpenAIAgentFactory(optionsMonitor, scopeFactory, _encryption, loggerFactory);
    }

    private static List<AiProvider> MakeProviders(string providerName, string modelId)
    {
        return
        [
            new AiProvider
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
            },
        ];
    }

    [Fact]
    public void ResolveProviderForModel_DecryptionFails_ReturnsNullAndLogsWarning()
    {
        var providers = MakeProviders("TestProvider", "gpt-4o");
        _encryption
            .Decrypt("encrypted-key")
            .Returns(_ => throw new InvalidOperationException("corrupt key"));

        var result = _sut.ResolveProviderForModel(providers, "gpt-4o");

        result.Should().BeNull();

        // Verify warning was logged with provider context
        var warningCalls = _logger
            .ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == "Log")
            .Select(c => c.GetArguments())
            .Where(a => a.Length > 0 && (LogLevel)a[0]! == LogLevel.Warning)
            .ToList();

        // Filter to the decryption warning (not the constructor's "AI not configured" warning)
        var decryptionWarning = warningCalls.FirstOrDefault(a =>
            a[2]!.ToString()!.Contains("decrypt", StringComparison.OrdinalIgnoreCase)
        );

        decryptionWarning
            .Should()
            .NotBeNull("a Warning log about decryption should have been emitted");
        var state = decryptionWarning![2]!.ToString()!;
        state.Should().Contain("TestProvider");
        state.Should().Contain("gpt-4o");
        decryptionWarning[3].Should().BeOfType<InvalidOperationException>();
    }

    [Fact]
    public void ResolveProviderForModel_DecryptionSucceeds_ReturnsResolvedProvider()
    {
        var providers = MakeProviders("TestProvider", "gpt-4o");
        _encryption.Decrypt("encrypted-key").Returns("decrypted-api-key");

        var result = _sut.ResolveProviderForModel(providers, "gpt-4o");

        result.Should().NotBeNull();
        result!.ProviderName.Should().Be("TestProvider");
        result.ApiKey.Should().Be("decrypted-api-key");
    }

    [Fact]
    public void ResolveProviderForModel_NoMatchingModel_ReturnsNull()
    {
        var providers = MakeProviders("TestProvider", "gpt-4o");

        var result = _sut.ResolveProviderForModel(providers, "nonexistent-model");

        result.Should().BeNull();
    }

    // ── Issue 121: Sync guard — if this test fails, update CONFIGURABLE_ACTIONS in ActionModelTable.tsx ──

    [Fact]
    public void ConfigurableActions_MatchesExpectedActionList()
    {
        // This test ensures the backend ConfigurableActions array stays in sync
        // with the frontend CONFIGURABLE_ACTIONS in ActionModelTable.tsx.
        // If you add/remove an action here, update the frontend array too.
        var expected = new[]
        {
            AiActionType.Generation,
            AiActionType.Evaluation,
            AiActionType.Clarification,
            AiActionType.SystemMessage,
            AiActionType.Decomposition,
            AiActionType.FillTemplateFields,
            AiActionType.PlaygroundJudge,
        };

        OpenAIAgentFactory
            .ConfigurableActions.Should()
            .BeEquivalentTo(
                expected,
                "ConfigurableActions changed — update CONFIGURABLE_ACTIONS in ActionModelTable.tsx"
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
        var providerRepo = Substitute.For<IAiProviderRepository>();
        providerRepo
            .GetAllAsync(Arg.Any<CancellationToken>())
            .Returns<List<AiProvider>>(_ => throw new Exception("DB down"));

        var factory = CreateFactory(MakeAllActionsSettings(), providerRepo);

        factory.IsConfigured.Should().BeFalse();
    }

    private OpenAIAgentFactory CreateFactoryWithAllActionsConfigured()
    {
        var settings = MakeAllActionsSettings();
        var providerRepo = Substitute.For<IAiProviderRepository>();
        providerRepo
            .GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(MakeProviders("TestProvider", "gpt-4o"));

        _encryption.Decrypt("encrypted-key").Returns("decrypted-api-key");

        return CreateFactory(settings, providerRepo);
    }

    private OpenAIAgentFactory CreateFactory(
        AiSettings settings,
        IAiProviderRepository? providerRepo = null
    )
    {
        if (providerRepo is null)
        {
            providerRepo = Substitute.For<IAiProviderRepository>();
            providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<AiProvider>());
        }

        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(typeof(IAiProviderRepository)).Returns(providerRepo);

        var scope = Substitute.For<IServiceScope>();
        scope.ServiceProvider.Returns(serviceProvider);

        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        scopeFactory.CreateScope().Returns(scope);

        var loggerFactory = Substitute.For<ILoggerFactory>();
        loggerFactory
            .CreateLogger(Arg.Any<string>())
            .Returns(Substitute.For<ILogger<OpenAIAgentFactory>>());

        var optionsMonitor = Substitute.For<IOptionsMonitor<AiSettings>>();
        optionsMonitor.CurrentValue.Returns(settings);

        return new OpenAIAgentFactory(optionsMonitor, scopeFactory, _encryption, loggerFactory);
    }

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
        };
}
