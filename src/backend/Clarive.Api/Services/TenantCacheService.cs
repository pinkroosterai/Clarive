using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace Clarive.Api.Services;

/// <summary>
/// Typed wrapper around IDistributedCache with tenant-scoped keys, graceful degradation,
/// and stampede protection via per-key locking.
/// </summary>
public class TenantCacheService(IDistributedCache cache, ILogger<TenantCacheService> logger)
{
    private static readonly TimeSpan DefaultTtl = TimeSpan.FromMinutes(5);
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Locks = new();

    /// <summary>
    /// Get a cached value or create it using the factory function.
    /// Uses per-key locking to prevent cache stampede on concurrent misses.
    /// Falls back to factory on cache failure (graceful degradation).
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
        return await GetOrCreateInternalAsync(fullKey, factory, ttl, ct);
    }

    /// <summary>
    /// Get or create a global (non-tenant-scoped) cached value.
    /// Used for data that is shared across tenants (e.g., AI provider lists).
    /// </summary>
    public async Task<T> GetOrCreateGlobalAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null,
        CancellationToken ct = default
    )
    {
        var fullKey = $"global:{key}";
        return await GetOrCreateInternalAsync(fullKey, factory, ttl, ct);
    }

    /// <summary>Evict a single cache key for a tenant.</summary>
    public async Task EvictAsync(string key, Guid tenantId, CancellationToken ct = default)
    {
        var fullKey = FormatKey(key, tenantId);
        try
        {
            await cache.RemoveAsync(fullKey, ct);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Valkey evict failed for key {CacheKey}", fullKey);
        }
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
        var fullKey = $"global:{key}";
        try
        {
            await cache.RemoveAsync(fullKey, ct);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Valkey evict failed for global key {CacheKey}", fullKey);
        }
    }

    private async Task<T> GetOrCreateInternalAsync<T>(
        string fullKey,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl,
        CancellationToken ct
    )
    {
        // Fast path: try cache read without lock
        try
        {
            var cached = await cache.GetStringAsync(fullKey, ct);
            if (cached is not null)
                return JsonSerializer.Deserialize<T>(cached)!;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Valkey read failed for key {CacheKey}, falling through to factory",
                fullKey
            );
        }

        // Slow path: acquire per-key lock to prevent stampede
        var semaphore = Locks.GetOrAdd(fullKey, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync(ct);
        try
        {
            // Double-check after acquiring lock — another thread may have populated
            try
            {
                var cached = await cache.GetStringAsync(fullKey, ct);
                if (cached is not null)
                    return JsonSerializer.Deserialize<T>(cached)!;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch
            { /* fall through to factory */
            }

            var value = await factory(ct);

            try
            {
                var json = JsonSerializer.Serialize(value);
                await cache.SetStringAsync(
                    fullKey,
                    json,
                    new DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = ttl ?? DefaultTtl,
                    },
                    ct
                );
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Valkey write failed for key {CacheKey}", fullKey);
            }

            return value;
        }
        finally
        {
            semaphore.Release();
        }
    }

    private static string FormatKey(string key, Guid tenantId) => $"{tenantId}:{key}";
}
