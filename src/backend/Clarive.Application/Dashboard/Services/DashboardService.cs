using Clarive.Domain.Interfaces.Services;
using System.Text.Json;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.QueryResults;
using Clarive.Infrastructure.Cache;

namespace Clarive.Application.Dashboard.Services;

public class DashboardService(
    IEntryRepository entryRepo,
    IFolderRepository folderRepo,
    IAuditLogRepository auditRepo,
    IFavoriteRepository favoriteRepo,
    ITenantCacheService cache
) : IDashboardService
{
    public async Task<DashboardStatsResponse> GetStatsAsync(
        Guid tenantId,
        Guid userId,
        CancellationToken ct
    )
    {
        // Cache aggregate stats (counts change infrequently relative to page views)
        var stats = await cache.GetOrCreateAsync(
            TenantCacheKeys.DashboardStatsKey,
            tenantId,
            async _ =>
            {
                var (total, published, unpublished) = await entryRepo.GetStatsAsync(tenantId, ct);
                var folderCount = await folderRepo.GetCountAsync(tenantId, ct);
                return new DashboardStatsCache(total, published, unpublished, folderCount);
            },
            TenantCacheKeys.DashboardStatsTtl,
            ct
        );

        // Cache recent entries + audit log (1-min TTL, invalidated on entry mutations)
        var recentData = await cache.GetOrCreateAsync(
            TenantCacheKeys.RecentEntriesKey,
            tenantId,
            async _ =>
            {
                var entries = await entryRepo.GetRecentAsync(tenantId, 8, ct);
                var (audit, _) = await auditRepo.GetPageAsync(tenantId, 1, 10, ct);
                return new RecentDataCache(entries, audit);
            },
            TenantCacheKeys.RecentEntriesTtl,
            ct
        );

        var recentEntries = recentData.Entries;
        var auditEntries = recentData.AuditEntries;

        var recentActivity = auditEntries
            .Select(a => new RecentActivityDto(
                a.Id,
                JsonNamingPolicy.SnakeCaseLower.ConvertName(a.Action.ToString()),
                a.EntityType,
                a.UserName,
                a.Details,
                a.Timestamp
            ))
            .ToList();

        // Favorites — per-user, fetched live
        var userFavorites = await favoriteRepo.GetByUserAsync(tenantId, userId, 8, ct);
        var favoriteEntryIds = userFavorites.Select(f => f.EntryId).ToList();
        var favoriteVersions =
            favoriteEntryIds.Count > 0
                ? await entryRepo.GetMainTabsBatchAsync(tenantId, favoriteEntryIds, ct)
                : new Dictionary<Guid, PromptEntryVersion>();

        // Resolve entry titles and build DTOs (batch fetch to avoid N+1)
        var favoriteEntries = new List<FavoriteEntryDto>();
        if (favoriteEntryIds.Count > 0)
        {
            var entriesById = await entryRepo.GetByIdsAsync(tenantId, favoriteEntryIds, ct);
            foreach (var (entryId, favoritedAt) in userFavorites)
            {
                if (!entriesById.TryGetValue(entryId, out var entry) || entry.IsTrashed)
                    continue;

                favoriteVersions.TryGetValue(entryId, out var version);
                var versionState = (version?.VersionState ?? VersionState.Tab)
                    .ToString()
                    .ToLower();
                favoriteEntries.Add(
                    new FavoriteEntryDto(entryId, entry.Title, versionState, favoritedAt)
                );
            }
        }

        return new DashboardStatsResponse(
            stats.Total,
            stats.Published,
            stats.Unpublished,
            stats.FolderCount,
            recentEntries,
            recentActivity,
            favoriteEntries
        );
    }

    private record DashboardStatsCache(int Total, int Published, int Unpublished, int FolderCount);

    private record RecentDataCache(List<RecentEntryDto> Entries, List<AuditLogEntry> AuditEntries);
}
