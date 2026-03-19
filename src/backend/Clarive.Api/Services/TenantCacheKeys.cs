namespace Clarive.Api.Services;

/// <summary>
/// Centralized cache key constants and eviction helpers for per-tenant cached data.
/// Keys are combined with tenant ID by TenantCacheService.
/// </summary>
public static class TenantCacheKeys
{
    public const string DashboardStatsKey = "dashboard:stats";
    public const string RecentEntriesKey = "dashboard:recent";
    public const string FolderTreeKey = "folders:tree";
    public const string WorkspaceTagsKey = "tags:workspace";
    public const string PublishedEntryIdsKey = "entries:published_ids";

    public static readonly TimeSpan DashboardStatsTtl = TimeSpan.FromMinutes(2);
    public static readonly TimeSpan RecentEntriesTtl = TimeSpan.FromMinutes(1);
    public static readonly TimeSpan FolderTreeTtl = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan WorkspaceTagsTtl = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan PublishedEntryIdsTtl = TimeSpan.FromMinutes(5);

    // Global (non-tenant-scoped) AI cache keys
    public const string AiProvidersKey = "ai_providers_all";
    public const string EnrichedModelsKey = "playground_enriched_models";
    public const string AvailableModelsKey = "playground_available_models";
    public const string ModelCostKeyPrefix = "model_cost";

    public static readonly TimeSpan AiCacheTtl = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan ModelCostTtl = TimeSpan.FromHours(1);

    /// <summary>Evict all cached data for a tenant's entries (dashboard stats + recent entries).</summary>
    public static Task EvictEntryData(TenantCacheService cache, Guid tenantId) =>
        cache.EvictAsync([DashboardStatsKey, RecentEntriesKey], tenantId);

    /// <summary>Evict all cached data for a tenant's folders (tree + dashboard stats + recent).</summary>
    public static Task EvictFolderData(TenantCacheService cache, Guid tenantId) =>
        cache.EvictAsync([FolderTreeKey, DashboardStatsKey, RecentEntriesKey], tenantId);

    /// <summary>Evict cached workspace tag data.</summary>
    public static Task EvictTagData(TenantCacheService cache, Guid tenantId) =>
        cache.EvictAsync(WorkspaceTagsKey, tenantId);

    /// <summary>Evict cached published entry ID set.</summary>
    public static Task EvictPublishedEntryIds(TenantCacheService cache, Guid tenantId) =>
        cache.EvictAsync(PublishedEntryIdsKey, tenantId);

    /// <summary>Evict all AI-related global caches (providers, models).
    /// Note: Per-model cost caches expire naturally via TTL (1 hour) since they use
    /// per-model keys that aren't bulk-evictable without SCAN.</summary>
    public static async Task EvictAiData(TenantCacheService cache)
    {
        await cache.EvictGlobalAsync(AiProvidersKey);
        await cache.EvictGlobalAsync(EnrichedModelsKey);
        await cache.EvictGlobalAsync(AvailableModelsKey);
    }

    /// <summary>Format a model cost cache key.</summary>
    public static string FormatModelCostKey(string provider, string model) =>
        $"{ModelCostKeyPrefix}:{provider}:{model}";

    /// <summary>Evict a specific model's cost cache.</summary>
    public static Task EvictModelCost(TenantCacheService cache, string provider, string model) =>
        cache.EvictGlobalAsync(FormatModelCostKey(provider, model));
}
