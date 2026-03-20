using Clarive.AI.Agents;
using Clarive.Domain.Entities;
using Clarive.Infrastructure.Security;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AiProviderResolverTests
{
    private readonly IEncryptionService _encryption = Substitute.For<IEncryptionService>();
    private readonly ILogger<AiProviderResolver> _logger;
    private readonly AiProviderResolver _sut;

    public AiProviderResolverTests()
    {
        _encryption.IsAvailable.Returns(true);

        var serviceProvider = Substitute.For<IServiceProvider>();
        var scope = Substitute.For<IServiceScope>();
        scope.ServiceProvider.Returns(serviceProvider);

        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        scopeFactory.CreateScope().Returns(scope);

        _logger = Substitute.For<ILogger<AiProviderResolver>>();

        _sut = new AiProviderResolver(scopeFactory, _encryption, _logger);
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
}
