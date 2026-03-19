using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Endpoints;

public static class SuperEndpoints
{
    public static RouteGroupBuilder MapSuperEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/super")
            .WithTags("Super Admin")
            .RequireAuthorization("SuperUser");

        group.MapGet("/stats", HandleGetStats);
        group.MapGet("/maintenance", HandleGetMaintenance);
        group.MapPost("/maintenance", HandleSetMaintenance);
        group.MapGet("/users", HandleGetUsers);
        group.MapDelete("/users/{userId}", HandleDeleteUser);
        group.MapPost("/users/{userId}/reset-password", HandleResetPassword);

        return group;
    }

    private static async Task<IResult> HandleGetStats(
        ISuperAdminService superAdminService,
        CancellationToken ct
    )
    {
        var stats = await superAdminService.GetPlatformStatsAsync(ct);
        return Results.Ok(stats);
    }

    private static IResult HandleGetMaintenance(IMaintenanceModeService maintenanceMode)
    {
        return Results.Ok(new { enabled = maintenanceMode.IsEnabled });
    }

    private static async Task<IResult> HandleSetMaintenance(
        HttpContext ctx,
        MaintenanceRequest request,
        IMaintenanceModeService maintenanceMode,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var changedBy = $"dashboard:{ctx.GetUserName()}";
        await maintenanceMode.SetEnabledAsync(request.Enabled, changedBy, ct);

        await auditLogger.SafeLogAsync(
            ctx.GetTenantId(),
            ctx.GetUserId(),
            ctx.GetUserName(),
            request.Enabled ? AuditAction.MaintenanceEnabled : AuditAction.MaintenanceDisabled,
            "System",
            Guid.Empty,
            "MaintenanceMode",
            $"Maintenance mode {(request.Enabled ? "enabled" : "disabled")} via dashboard",
            ct
        );

        return Results.Ok(new { enabled = maintenanceMode.IsEnabled });
    }

    private const int MaxPageSize = 200;

    private static async Task<IResult> HandleGetUsers(
        ISuperAdminService superAdminService,
        int page = 1,
        int pageSize = 20,
        string? search = null,
        string? sortBy = null,
        bool sortDesc = true,
        CancellationToken ct = default
    )
    {
        pageSize = Math.Min(pageSize, MaxPageSize);
        var (users, total) = await superAdminService.GetAllUsersPagedAsync(
            page,
            pageSize,
            search,
            sortBy,
            sortDesc,
            ct
        );
        return Results.Ok(new SuperUsersPagedResponse(users, total, page, pageSize));
    }

    private static async Task<IResult> HandleDeleteUser(
        HttpContext ctx,
        Guid userId,
        ISuperAdminService superAdminService,
        bool hard = false,
        CancellationToken ct = default
    )
    {
        var currentUserId = ctx.GetUserId();
        if (currentUserId == userId)
            return ctx.ErrorResult(409, "CANNOT_DELETE_SELF", "Cannot delete your own account.");

        bool found;
        if (hard)
            found = await superAdminService.HardDeleteUserAsync(userId, ct);
        else
            found = await superAdminService.SoftDeleteUserAsync(userId, ct);

        return found ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> HandleResetPassword(
        HttpContext ctx,
        Guid userId,
        ISuperAdminService superAdminService,
        CancellationToken ct = default
    )
    {
        var result = await superAdminService.ResetUserPasswordAsync(userId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new ResetPasswordResponse(NewPassword: result.Value));
    }
}
