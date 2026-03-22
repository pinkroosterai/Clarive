using Clarive.Application.Background;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class LiteLlmSyncJobTests
{
    private readonly IHttpClientFactory _httpClientFactory = Substitute.For<IHttpClientFactory>();
    private readonly ILiteLlmRegistryCache _registryCache = Substitute.For<ILiteLlmRegistryCache>();
    private readonly IAiProviderRepository _providerRepo = Substitute.For<IAiProviderRepository>();
    private readonly ILogger<LiteLlmSyncJob> _logger = Substitute.For<ILogger<LiteLlmSyncJob>>();
    private readonly IJobExecutionContext _context = Substitute.For<IJobExecutionContext>();
    private readonly LiteLlmSyncJob _sut;

    public LiteLlmSyncJobTests()
    {
        _context.CancellationToken.Returns(CancellationToken.None);
        _sut = new LiteLlmSyncJob(_httpClientFactory, _registryCache, _providerRepo, _logger);
    }

    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(LiteLlmSyncJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty();
    }

    [Fact]
    public void Job_ImplementsIJob()
    {
        typeof(LiteLlmSyncJob).Should().Implement<IJob>();
    }

    [Fact]
    public async Task Execute_WhenCacheNotLoaded_LoadsFromLocalFile()
    {
        _registryCache.IsLoadedAsync(Arg.Any<CancellationToken>())
            .Returns(false, true);

        // HTTP fetch will fail (no handler configured) but that's OK — we're testing cold-start path
        var handler = new HttpClientHandler();
        _httpClientFactory.CreateClient(Arg.Any<string>()).Returns(new HttpClient());

        // Execute will try to fetch from GitHub and fail, but should not throw
        var act = () => _sut.Execute(_context);
        await act.Should().NotThrowAsync();

        // Should have attempted to load from local cache
        await _registryCache.Received(1).LoadFromFileAsync(
            Arg.Any<string>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Execute_WhenCacheAlreadyLoaded_SkipsLocalCacheLoad()
    {
        _registryCache.IsLoadedAsync(Arg.Any<CancellationToken>()).Returns(true);
        _httpClientFactory.CreateClient(Arg.Any<string>()).Returns(new HttpClient());

        var act = () => _sut.Execute(_context);
        await act.Should().NotThrowAsync();

        // Should NOT have loaded from local cache
        await _registryCache.DidNotReceive().LoadFromFileAsync(
            Arg.Any<string>(),
            Arg.Any<CancellationToken>());
    }
}
