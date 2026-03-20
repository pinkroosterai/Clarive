using Clarive.Infrastructure.Cache;
using FluentAssertions;
using NSubstitute;
using ZiggyCreatures.Caching.Fusion;

namespace Clarive.Api.UnitTests.Services;

public class TenantCacheServiceTests
{
    private readonly IFusionCache _fusionCache = Substitute.For<IFusionCache>();
    private readonly TenantCacheService _sut;
    private readonly Guid _tenantId = Guid.NewGuid();

    public TenantCacheServiceTests()
    {
        _sut = new TenantCacheService(_fusionCache);
    }

    [Fact]
    public async Task GetOrCreateAsync_UsesTenantScopedKey()
    {
        var expectedKey = $"{_tenantId}:test-key";
        _fusionCache
            .GetOrSetAsync<string>(
                expectedKey,
                Arg.Any<Func<FusionCacheFactoryExecutionContext<string>, CancellationToken, Task<string>>>(),
                Arg.Any<FusionCacheEntryOptions>(),
                Arg.Any<CancellationToken>()
            )
            .Returns("cached");

        var result = await _sut.GetOrCreateAsync<string>(
            "test-key",
            _tenantId,
            _ => Task.FromResult("cached")
        );

        result.Should().Be("cached");
        await _fusionCache
            .Received(1)
            .GetOrSetAsync<string>(
                expectedKey,
                Arg.Any<Func<FusionCacheFactoryExecutionContext<string>, CancellationToken, Task<string>>>(),
                Arg.Any<FusionCacheEntryOptions>(),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task GetOrCreateGlobalAsync_UsesGlobalPrefix()
    {
        _fusionCache
            .GetOrSetAsync<string>(
                "global:my-global",
                Arg.Any<Func<FusionCacheFactoryExecutionContext<string>, CancellationToken, Task<string>>>(),
                Arg.Any<FusionCacheEntryOptions>(),
                Arg.Any<CancellationToken>()
            )
            .Returns("global-val");

        var result = await _sut.GetOrCreateGlobalAsync<string>(
            "my-global",
            _ => Task.FromResult("global-val")
        );

        result.Should().Be("global-val");
        await _fusionCache
            .Received(1)
            .GetOrSetAsync<string>(
                "global:my-global",
                Arg.Any<Func<FusionCacheFactoryExecutionContext<string>, CancellationToken, Task<string>>>(),
                Arg.Any<FusionCacheEntryOptions>(),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task GetOrCreateAsync_ScopesByTenantId()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        await _sut.GetOrCreateAsync<string>("shared-key", tenantA, _ => Task.FromResult("a"));
        await _sut.GetOrCreateAsync<string>("shared-key", tenantB, _ => Task.FromResult("b"));

        await _fusionCache
            .Received(1)
            .GetOrSetAsync<string>(
                $"{tenantA}:shared-key",
                Arg.Any<Func<FusionCacheFactoryExecutionContext<string>, CancellationToken, Task<string>>>(),
                Arg.Any<FusionCacheEntryOptions>(),
                Arg.Any<CancellationToken>()
            );
        await _fusionCache
            .Received(1)
            .GetOrSetAsync<string>(
                $"{tenantB}:shared-key",
                Arg.Any<Func<FusionCacheFactoryExecutionContext<string>, CancellationToken, Task<string>>>(),
                Arg.Any<FusionCacheEntryOptions>(),
                Arg.Any<CancellationToken>()
            );
    }

    [Fact]
    public async Task EvictAsync_CallsRemoveWithScopedKey()
    {
        await _sut.EvictAsync("some-key", _tenantId);

        await _fusionCache
            .Received(1)
            .RemoveAsync($"{_tenantId}:some-key", Arg.Any<FusionCacheEntryOptions>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EvictAsync_BatchKeys_EvictsAll()
    {
        var keys = new[] { "key1", "key2", "key3" };

        await _sut.EvictAsync(keys, _tenantId);

        foreach (var key in keys)
        {
            await _fusionCache
                .Received(1)
                .RemoveAsync($"{_tenantId}:{key}", Arg.Any<FusionCacheEntryOptions>(), Arg.Any<CancellationToken>());
        }
    }

    [Fact]
    public async Task EvictGlobalAsync_CallsRemoveWithGlobalPrefix()
    {
        await _sut.EvictGlobalAsync("some-global");

        await _fusionCache
            .Received(1)
            .RemoveAsync("global:some-global", Arg.Any<FusionCacheEntryOptions>(), Arg.Any<CancellationToken>());
    }
}
