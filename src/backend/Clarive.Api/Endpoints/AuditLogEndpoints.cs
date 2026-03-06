using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Auth;

namespace Clarive.Api.Endpoints;

public static class AuditLogEndpoints
{
    public static RouteGroupBuilder MapAuditLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/audit-log")
            .WithTags("Audit Log")
            .RequireAuthorization();

        group.MapGet("/", HandleGetPage);

        return group;
    }

    private static async Task<IResult> HandleGetPage(
        HttpContext ctx,
        IAuditLogRepository auditRepo,
        CancellationToken ct,
        int page = 1,
        int pageSize = 20)
    {
        var tenantId = ctx.GetTenantId();

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var (entries, total) = await auditRepo.GetPageAsync(tenantId, page, pageSize, ct);
        return Results.Ok(new PaginatedAuditLog(entries, total, page, pageSize));
    }
}
