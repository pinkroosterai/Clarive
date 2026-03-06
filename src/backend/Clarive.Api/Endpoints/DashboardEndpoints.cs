using System.Text.Json;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Microsoft.Extensions.Caching.Memory;
using Clarive.Api.Auth;

namespace Clarive.Api.Endpoints;

public static class DashboardEndpoints
{
    public static RouteGroupBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dashboard")
            .WithTags("Dashboard")
            .RequireAuthorization();

        group.MapGet("/stats", HandleGetStats);

        return group;
    }

    private static async Task<IResult> HandleGetStats(
        HttpContext ctx,
        IEntryRepository entryRepo,
        IFolderRepository folderRepo,
        IAuditLogRepository auditRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var cacheKey = TenantCacheKeys.DashboardStats(tenantId);

        // Cache aggregate stats (counts change infrequently relative to page views)
        var stats = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.SetOptions(TenantCacheKeys.DashboardStatsOptions);

            var (total, published, drafts) = await entryRepo.GetStatsAsync(tenantId, ct);
            var folderCount = await folderRepo.GetCountAsync(tenantId, ct);
            return (total, published, drafts, folderCount);
        });

        // Recent data stays live — changes too frequently to cache
        var recentEntries = await entryRepo.GetRecentAsync(tenantId, 8, ct);
        var (auditEntries, _) = await auditRepo.GetPageAsync(tenantId, 1, 10, ct);

        var recentActivity = auditEntries.Select(a => new RecentActivityDto(
            a.Id,
            JsonNamingPolicy.SnakeCaseLower.ConvertName(a.Action.ToString()),
            a.EntityType,
            a.UserName,
            a.Details,
            a.Timestamp)).ToList();

        return Results.Ok(new DashboardStatsResponse(
            stats.total, stats.published, stats.drafts, stats.folderCount,
            recentEntries, recentActivity));
    }
}
