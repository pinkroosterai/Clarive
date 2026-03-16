using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using FluentAssertions;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class ModelResolutionServiceTests : IDisposable
{
    private readonly IAiProviderRepository _providerRepo = Substitute.For<IAiProviderRepository>();
    private readonly IAgentFactory _agentFactory = Substitute.For<IAgentFactory>();
    private readonly IEncryptionService _encryption = Substitute.For<IEncryptionService>();
    private readonly IOptionsMonitor<AiSettings> _aiSettings = Substitute.For<IOptionsMonitor<AiSettings>>();
    private readonly IMemoryCache _cache = new MemoryCache(new MemoryCacheOptions());
    private readonly ILogger<ModelResolutionService> _logger = Substitute.For<ILogger<ModelResolutionService>>();
    private readonly ModelResolutionService _sut;

    public ModelResolutionServiceTests()
    {
        _aiSettings.CurrentValue.Returns(new AiSettings
        {
            DefaultModel = "gpt-4o",
            AllowedModels = ""
        });
        _encryption.IsAvailable.Returns(true);

        _sut = new ModelResolutionService(_providerRepo, _agentFactory, _encryption, _aiSettings, _cache, _logger);
    }

    public void Dispose()
    {
        _cache.Dispose();
        GC.SuppressFinalize(this);
    }

    private static AiProvider MakeProvider(string name = "TestProvider", params (string modelId, bool isActive)[] models)
    {
        var provider = new AiProvider
        {
            Id = Guid.NewGuid(),
            Name = name,
            ApiKeyEncrypted = "encrypted-key",
            EndpointUrl = "https://api.openai.com/v1",
            IsActive = true,
            Models = models.Select(m => new AiProviderModel
            {
                Id = Guid.NewGuid(),
                ModelId = m.modelId,
                IsActive = m.isActive,
                IsReasoning = false,
                MaxInputTokens = 128000,
            }).ToList()
        };
        return provider;
    }

    // ── ResolveProviderForModelAsync ──

    [Fact]
    public async Task ResolveProviderForModelAsync_Success_ReturnsResolvedModel()
    {
        var provider = MakeProvider("OpenAI", ("gpt-4o", true));
        _providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([provider]);
        _encryption.Decrypt("encrypted-key").Returns("decrypted-api-key");

        var mockClient = Substitute.For<IChatClient>();
        _agentFactory.CreateChatClientForProvider("decrypted-api-key", "https://api.openai.com/v1", "gpt-4o")
            .Returns(mockClient);

        // Prime the available models cache by setting it directly
        _cache.Set("playground_available_models", new List<string> { "gpt-4o" },
            new MemoryCacheEntryOptions { Size = 1 });

        var result = await _sut.ResolveProviderForModelAsync("gpt-4o", default);

        result.IsError.Should().BeFalse();
        result.Value.Model.Should().Be("gpt-4o");
        result.Value.ProviderName.Should().Be("OpenAI");
        result.Value.ChatClient.Should().Be(mockClient);
    }

    [Fact]
    public async Task ResolveProviderForModelAsync_ModelNotAvailable_ReturnsValidationError()
    {
        // Prime cache with models that don't include the requested one
        _cache.Set("playground_available_models", new List<string> { "gpt-4o" },
            new MemoryCacheEntryOptions { Size = 1 });

        var result = await _sut.ResolveProviderForModelAsync("nonexistent-model", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_MODEL");
    }

    [Fact]
    public async Task ResolveProviderForModelAsync_DecryptionFails_ReturnsFailure()
    {
        var provider = MakeProvider("OpenAI", ("gpt-4o", true));
        _providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([provider]);
        _encryption.Decrypt("encrypted-key").Returns(_ => throw new Exception("Decryption failed"));

        _cache.Set("playground_available_models", new List<string> { "gpt-4o" },
            new MemoryCacheEntryOptions { Size = 1 });

        var result = await _sut.ResolveProviderForModelAsync("gpt-4o", default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("DECRYPTION_FAILED");
    }

    [Fact]
    public async Task ResolveProviderForModelAsync_NoProviderMatch_UsesDefaultClient()
    {
        _providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns(new List<AiProvider>());

        var mockClient = Substitute.For<IChatClient>();
        _agentFactory.CreateChatClient("gpt-4o").Returns(mockClient);

        _cache.Set("playground_available_models", new List<string> { "gpt-4o" },
            new MemoryCacheEntryOptions { Size = 1 });

        var result = await _sut.ResolveProviderForModelAsync("gpt-4o", default);

        result.IsError.Should().BeFalse();
        result.Value.ChatClient.Should().Be(mockClient);
        result.Value.ProviderName.Should().Be("Default");
    }

    // ── GetEnrichedModelsAsync ──

    [Fact]
    public async Task GetEnrichedModelsAsync_WithActiveProviders_ReturnsEnrichedModels()
    {
        var provider = MakeProvider("OpenAI", ("gpt-4o", true), ("gpt-4o-mini", true));
        _providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([provider]);

        var result = await _sut.GetEnrichedModelsAsync(default);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(2);
        result.Value[0].ModelId.Should().Be("gpt-4o");
        result.Value[1].ModelId.Should().Be("gpt-4o-mini");
    }

    [Fact]
    public async Task GetEnrichedModelsAsync_CachesResult()
    {
        var provider = MakeProvider("OpenAI", ("gpt-4o", true));
        _providerRepo.GetAllAsync(Arg.Any<CancellationToken>()).Returns([provider]);

        await _sut.GetEnrichedModelsAsync(default);
        await _sut.GetEnrichedModelsAsync(default);

        await _providerRepo.Received(1).GetAllAsync(Arg.Any<CancellationToken>());
    }
}
