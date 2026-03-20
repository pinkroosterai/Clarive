using ZiggyCreatures.Caching.Fusion;

namespace Clarive.Infrastructure.Cache;

/// <summary>
/// Typed wrapper around IFusionCache with tenant-scoped keys.
/// FusionCache provides L1 memory + L2 distributed (Valkey), stampede protection,
/// fail-safe, and eager refresh out of the box.
/// </summary>
public class TenantCacheService(IFusionCache cache)
{
    private static readonly TimeSpan DefaultTtl = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Get a cached value or create it using the factory function.
    /// FusionCache handles stampede protection and L1/L2 tiering automatically.
    /// </summary>
    public async Task<T> GetOrCreateAsync<T>(
        string key,
        Guid tenantId,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null,
        CancellationToken ct = default
    )
    {
        var fullKey = FormatKey(key, tenantId);
        return await cache.GetOrSetAsync<T>(
            fullKey,
            async (_, ct2) => await factory(ct2),
            new FusionCacheEntryOptions { Duration = ttl ?? DefaultTtl },
            ct
        );
    }

    /// <summary>
    /// Get or create a global (non-tenant-scoped) cached value.
    /// Used for data shared across tenants (e.g., AI provider lists).
    /// </summary>
    public async Task<T> GetOrCreateGlobalAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null,
        CancellationToken ct = default
    )
    {
        var fullKey = $"global:{key}";
        return await cache.GetOrSetAsync<T>(
            fullKey,
            async (_, ct2) => await factory(ct2),
            new FusionCacheEntryOptions { Duration = ttl ?? DefaultTtl },
            ct
        );
    }

    /// <summary>Evict a single cache key for a tenant.</summary>
    public async Task EvictAsync(string key, Guid tenantId, CancellationToken ct = default)
    {
        await cache.RemoveAsync(FormatKey(key, tenantId), token: ct);
    }

    /// <summary>Evict multiple cache keys for a tenant.</summary>
    public async Task EvictAsync(string[] keys, Guid tenantId, CancellationToken ct = default)
    {
        var tasks = keys.Select(key => EvictAsync(key, tenantId, ct));
        await Task.WhenAll(tasks);
    }

    /// <summary>Evict a global (non-tenant-scoped) cache key.</summary>
    public async Task EvictGlobalAsync(string key, CancellationToken ct = default)
    {
        await cache.RemoveAsync($"global:{key}", token: ct);
    }

    private static string FormatKey(string key, Guid tenantId) => $"{tenantId}:{key}";
}
