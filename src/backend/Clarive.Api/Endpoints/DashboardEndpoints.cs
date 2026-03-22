using Clarive.Api.Helpers;
using Clarive.Application.Dashboard.Contracts;

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
        IDashboardService dashboardService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var stats = await dashboardService.GetStatsAsync(tenantId, userId, ct);

        return Results.Ok(stats);
    }
}
