using Microsoft.Extensions.Caching.Memory;

namespace Clarive.Api.Services;

/// <summary>
/// Centralized cache key helpers for per-tenant cached data.
/// </summary>
public static class TenantCacheKeys
{
    public static string DashboardStats(Guid tenantId) => $"dashboard:stats:{tenantId}";
    public static string FolderTree(Guid tenantId) => $"folders:tree:{tenantId}";
    public static string WorkspaceTags(Guid tenantId) => $"tags:workspace:{tenantId}";

    private static readonly TimeSpan DashboardStatsDuration = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan FolderTreeDuration = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan WorkspaceTagsDuration = TimeSpan.FromMinutes(5);

    public static MemoryCacheEntryOptions DashboardStatsOptions => new()
    {
        AbsoluteExpirationRelativeToNow = DashboardStatsDuration,
        Size = 1
    };

    public static MemoryCacheEntryOptions FolderTreeOptions => new()
    {
        AbsoluteExpirationRelativeToNow = FolderTreeDuration,
        Size = 1
    };

    public static MemoryCacheEntryOptions WorkspaceTagsOptions => new()
    {
        AbsoluteExpirationRelativeToNow = WorkspaceTagsDuration,
        Size = 1
    };

    /// <summary>Evict all cached data for a tenant's entries (dashboard stats).</summary>
    public static void EvictEntryData(IMemoryCache cache, Guid tenantId)
    {
        cache.Remove(DashboardStats(tenantId));
    }

    /// <summary>Evict all cached data for a tenant's folders (tree + dashboard stats).</summary>
    public static void EvictFolderData(IMemoryCache cache, Guid tenantId)
    {
        cache.Remove(FolderTree(tenantId));
        cache.Remove(DashboardStats(tenantId));
    }

    /// <summary>Evict cached workspace tag data.</summary>
    public static void EvictTagData(IMemoryCache cache, Guid tenantId)
    {
        cache.Remove(WorkspaceTags(tenantId));
    }
}
