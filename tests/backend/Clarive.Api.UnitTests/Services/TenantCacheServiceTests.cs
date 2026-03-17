using System.Text;
using System.Text.Json;
using Clarive.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Clarive.Api.UnitTests.Services;

public class TenantCacheServiceTests
{
    private readonly IDistributedCache _cache = Substitute.For<IDistributedCache>();
    private readonly ILogger<TenantCacheService> _logger = Substitute.For<ILogger<TenantCacheService>>();
    private readonly TenantCacheService _sut;
    private readonly Guid _tenantId = Guid.NewGuid();

    public TenantCacheServiceTests()
    {
        _sut = new TenantCacheService(_cache, _logger);
    }

    [Fact]
    public async Task GetOrCreateAsync_CacheHit_ReturnsDeserializedValue()
    {
        var expected = new TestDto("hello", 42);
        var json = JsonSerializer.Serialize(expected);
        var fullKey = $"{_tenantId}:test-key";

        _cache.GetAsync(fullKey, Arg.Any<CancellationToken>())
            .Returns(Encoding.UTF8.GetBytes(json));

        var factoryCalled = false;
        var result = await _sut.GetOrCreateAsync<TestDto>("test-key", _tenantId, _ =>
        {
            factoryCalled = true;
            return Task.FromResult(new TestDto("should not", 0));
        });

        result.Should().BeEquivalentTo(expected);
        factoryCalled.Should().BeFalse();
    }

    [Fact]
    public async Task GetOrCreateAsync_CacheMiss_CallsFactoryAndStores()
    {
        var expected = new TestDto("created", 99);
        var fullKey = $"{_tenantId}:miss-key";

        _cache.GetAsync(fullKey, Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        var result = await _sut.GetOrCreateAsync<TestDto>("miss-key", _tenantId, _ =>
            Task.FromResult(expected));

        result.Should().BeEquivalentTo(expected);

        await _cache.Received().SetAsync(
            fullKey,
            Arg.Any<byte[]>(),
            Arg.Any<DistributedCacheEntryOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetOrCreateAsync_CacheThrows_FallsBackToFactory()
    {
        var expected = new TestDto("fallback", 1);

        _cache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Valkey down"));

        var result = await _sut.GetOrCreateAsync<TestDto>("fail-key", _tenantId, _ =>
            Task.FromResult(expected));

        result.Should().BeEquivalentTo(expected);
    }

    [Fact]
    public async Task GetOrCreateAsync_WriteThrows_StillReturnsFactoryValue()
    {
        var expected = new TestDto("write-fail", 2);

        _cache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);
        _cache.SetAsync(Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<DistributedCacheEntryOptions>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Valkey down"));

        var result = await _sut.GetOrCreateAsync<TestDto>("write-fail-key", _tenantId, _ =>
            Task.FromResult(expected));

        result.Should().BeEquivalentTo(expected);
    }

    [Fact]
    public async Task GetOrCreateAsync_CancellationThrows_Propagates()
    {
        _cache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var act = async () => await _sut.GetOrCreateAsync<TestDto>("cancel-key", _tenantId, _ =>
            Task.FromResult(new TestDto("x", 0)));

        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task EvictAsync_CacheThrows_DoesNotThrow()
    {
        _cache.RemoveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Valkey down"));

        var act = async () => await _sut.EvictAsync("some-key", _tenantId);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task EvictAsync_CancellationThrows_Propagates()
    {
        _cache.RemoveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new OperationCanceledException());

        var act = async () => await _sut.EvictAsync("some-key", _tenantId);

        await act.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task EvictAsync_BatchKeys_EvictsAll()
    {
        var keys = new[] { "key1", "key2", "key3" };

        await _sut.EvictAsync(keys, _tenantId);

        foreach (var key in keys)
        {
            await _cache.Received(1).RemoveAsync(
                $"{_tenantId}:{key}",
                Arg.Any<CancellationToken>());
        }
    }

    [Fact]
    public async Task GetOrCreateAsync_ScopesByTenantId()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        _cache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        await _sut.GetOrCreateAsync<string>("shared-key", tenantA, _ => Task.FromResult("a"));
        await _sut.GetOrCreateAsync<string>("shared-key", tenantB, _ => Task.FromResult("b"));

        // 2 calls per key: fast-path read + double-check after lock
        await _cache.Received(2).GetAsync($"{tenantA}:shared-key", Arg.Any<CancellationToken>());
        await _cache.Received(2).GetAsync($"{tenantB}:shared-key", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetOrCreateAsync_RespectsTtl()
    {
        var ttl = TimeSpan.FromMinutes(2);
        _cache.GetAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        await _sut.GetOrCreateAsync<string>("ttl-key", _tenantId, _ => Task.FromResult("val"), ttl);

        await _cache.Received(1).SetAsync(
            Arg.Any<string>(),
            Arg.Any<byte[]>(),
            Arg.Is<DistributedCacheEntryOptions>(o => o.AbsoluteExpirationRelativeToNow == ttl),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetOrCreateGlobalAsync_UsesGlobalPrefix()
    {
        _cache.GetAsync("global:my-global", Arg.Any<CancellationToken>())
            .Returns((byte[]?)null);

        await _sut.GetOrCreateGlobalAsync<string>("my-global", _ => Task.FromResult("val"));

        await _cache.Received().GetAsync("global:my-global", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EvictGlobalAsync_CacheThrows_DoesNotThrow()
    {
        _cache.RemoveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("Valkey down"));

        var act = async () => await _sut.EvictGlobalAsync("some-global");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task GetOrCreateAsync_StampedeProtection_FactoryCalledOnce()
    {
        var factoryCallCount = 0;
        var fullKey = $"{_tenantId}:stampede-key";

        // Mock remembers what was stored so double-check after lock finds it
        byte[]? stored = null;
        _cache.GetAsync(fullKey, Arg.Any<CancellationToken>())
            .Returns(_ => stored);
        _cache.SetAsync(fullKey, Arg.Any<byte[]>(), Arg.Any<DistributedCacheEntryOptions>(), Arg.Any<CancellationToken>())
            .Returns(ci => { stored = ci.ArgAt<byte[]>(1); return Task.CompletedTask; });

        // Launch multiple concurrent calls for the same key
        var tasks = Enumerable.Range(0, 10).Select(_ =>
            _sut.GetOrCreateAsync<string>("stampede-key", _tenantId, async ct =>
            {
                Interlocked.Increment(ref factoryCallCount);
                await Task.Delay(50, ct); // Simulate work
                return "value";
            }));

        await Task.WhenAll(tasks);

        // With stampede protection, factory should be called exactly once
        // (first caller acquires lock and stores; others wait and get the cached result from double-check)
        factoryCallCount.Should().Be(1);
    }

    private sealed record TestDto(string Name, int Value);
}
