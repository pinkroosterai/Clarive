namespace Clarive.Domain.Interfaces.Services;

/// <summary>
/// Tenant-scoped caching abstraction with stampede protection and multi-level tiering.
/// </summary>
public interface ITenantCacheService
{
    /// <summary>
    /// Get a cached value or create it using the factory function.
    /// Implementations handle stampede protection and L1/L2 tiering automatically.
    /// </summary>
    Task<T> GetOrCreateAsync<T>(
        string key,
        Guid tenantId,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null,
        CancellationToken ct = default
    );

    /// <summary>
    /// Get or create a global (non-tenant-scoped) cached value.
    /// Used for data shared across tenants (e.g., AI provider lists).
    /// </summary>
    Task<T> GetOrCreateGlobalAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null,
        CancellationToken ct = default
    );

    /// <summary>Evict a single cache key for a tenant.</summary>
    Task EvictAsync(string key, Guid tenantId, CancellationToken ct = default);

    /// <summary>Evict multiple cache keys for a tenant.</summary>
    Task EvictAsync(string[] keys, Guid tenantId, CancellationToken ct = default);

    /// <summary>Evict a global (non-tenant-scoped) cache key.</summary>
    Task EvictGlobalAsync(string key, CancellationToken ct = default);
}
