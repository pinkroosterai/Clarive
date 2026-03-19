using System.Text.Json;
using Clarive.Api.Auth;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;

namespace Clarive.Api.Endpoints;

public static class DashboardEndpoints
{
    public static RouteGroupBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dashboard").WithTags("Dashboard").RequireAuthorization();

        group.MapGet("/stats", HandleGetStats);

        return group;
    }

    private static async Task<IResult> HandleGetStats(
        HttpContext ctx,
        IEntryRepository entryRepo,
        IFolderRepository folderRepo,
        IAuditLogRepository auditRepo,
        IFavoriteRepository favoriteRepo,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        // Cache aggregate stats (counts change infrequently relative to page views)
        var stats = await cache.GetOrCreateAsync(
            TenantCacheKeys.DashboardStatsKey,
            tenantId,
            async _ =>
            {
                var (total, published, drafts) = await entryRepo.GetStatsAsync(tenantId, ct);
                var folderCount = await folderRepo.GetCountAsync(tenantId, ct);
                return new DashboardStatsCache(total, published, drafts, folderCount);
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
                ? await entryRepo.GetWorkingVersionsBatchAsync(tenantId, favoriteEntryIds, ct)
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
                var versionState = (version?.VersionState ?? Models.Enums.VersionState.Draft)
                    .ToString()
                    .ToLower();
                favoriteEntries.Add(
                    new FavoriteEntryDto(entryId, entry.Title, versionState, favoritedAt)
                );
            }
        }

        return Results.Ok(
            new DashboardStatsResponse(
                stats.Total,
                stats.Published,
                stats.Drafts,
                stats.FolderCount,
                recentEntries,
                recentActivity,
                favoriteEntries
            )
        );
    }

    private record DashboardStatsCache(int Total, int Published, int Drafts, int FolderCount);

    private record RecentDataCache(List<RecentEntryDto> Entries, List<AuditLogEntry> AuditEntries);
}
