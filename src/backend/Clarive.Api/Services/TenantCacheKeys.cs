namespace Clarive.Api.Services;

/// <summary>
/// Centralized cache key constants and eviction helpers for per-tenant cached data.
/// Keys are combined with tenant ID by TenantCacheService.
/// </summary>
public static class TenantCacheKeys
{
    public const string DashboardStatsKey = "dashboard:stats";
    public const string FolderTreeKey = "folders:tree";
    public const string WorkspaceTagsKey = "tags:workspace";

    public static readonly TimeSpan DashboardStatsTtl = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan FolderTreeTtl = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan WorkspaceTagsTtl = TimeSpan.FromMinutes(5);

    // Global (non-tenant-scoped) AI cache keys
    public const string AiProvidersKey = "ai_providers_all";
    public const string EnrichedModelsKey = "playground_enriched_models";
    public const string AvailableModelsKey = "playground_available_models";

    public static readonly TimeSpan AiCacheTtl = TimeSpan.FromMinutes(5);

    /// <summary>Evict all cached data for a tenant's entries (dashboard stats).</summary>
    public static Task EvictEntryData(TenantCacheService cache, Guid tenantId)
        => cache.EvictAsync(DashboardStatsKey, tenantId);

    /// <summary>Evict all cached data for a tenant's folders (tree + dashboard stats).</summary>
    public static Task EvictFolderData(TenantCacheService cache, Guid tenantId)
        => cache.EvictAsync([FolderTreeKey, DashboardStatsKey], tenantId);

    /// <summary>Evict cached workspace tag data.</summary>
    public static Task EvictTagData(TenantCacheService cache, Guid tenantId)
        => cache.EvictAsync(WorkspaceTagsKey, tenantId);

    /// <summary>Evict all AI-related global caches (providers, models).</summary>
    public static async Task EvictAiData(TenantCacheService cache)
    {
        await cache.EvictGlobalAsync(AiProvidersKey);
        await cache.EvictGlobalAsync(EnrichedModelsKey);
        await cache.EvictGlobalAsync(AvailableModelsKey);
    }
}
