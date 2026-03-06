using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Services;

namespace Clarive.Api.Endpoints;

public static class UserEndpoints
{
    public static RouteGroupBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Users")
            .RequireAuthorization();

        group.MapGet("/", HandleList);

        group.MapPatch("/{userId:guid}/role", HandleChangeRole)
            .RequireAuthorization("AdminOnly");

        group.MapDelete("/{userId:guid}", HandleDelete)
            .RequireAuthorization("AdminOnly");

        group.MapPost("/transfer-ownership", HandleTransferOwnership)
            .RequireAuthorization("AdminOnly");

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IUserManagementService userManagementService,
        CancellationToken ct,
        int page = 1,
        int pageSize = 50)
    {
        var tenantId = ctx.GetTenantId();
        var result = await userManagementService.ListMembersAsync(tenantId, page, pageSize, ct);
        return Results.Ok(new { items = result.Items, total = result.Total, page = result.Page, pageSize = result.PageSize });
    }

    private static async Task<IResult> HandleChangeRole(
        Guid userId,
        HttpContext ctx,
        UpdateUserRoleRequest request,
        IUserManagementService userManagementService,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var currentUserId = ctx.GetUserId();

        if (userId == currentUserId)
            return ctx.ErrorResult(409, "CANNOT_CHANGE_OWN_ROLE", "Cannot change your own role.", "User", userId.ToString());

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Role must be 'admin', 'editor', or 'viewer'.");

        var (result, errorCode, errorMessage) = await userManagementService.ChangeRoleAsync(tenantId, userId, role, ct);
        if (result is null)
        {
            var statusCode = errorCode == "NOT_FOUND" ? 404 : 422;
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!, "User", userId.ToString());
        }

        await auditLogger.SafeLogAsync(tenantId, currentUserId, ctx.GetUserName(), AuditAction.UserRoleChanged,
            "user", userId, result.User.Email, $"Changed role from {result.OldRole} to {result.NewRole}", ct);

        return Results.Ok(new
        {
            result.User.Id, result.User.Email, result.User.Name,
            Role = result.NewRole,
            result.User.CreatedAt
        });
    }

    private static async Task<IResult> HandleDelete(
        Guid userId,
        HttpContext ctx,
        IUserManagementService userManagementService,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var currentUserId = ctx.GetUserId();

        if (userId == currentUserId)
            return ctx.ErrorResult(409, "CANNOT_DELETE_SELF", "Cannot delete your own account.", "User", userId.ToString());

        var (removedUser, errorCode, errorMessage) = await userManagementService.RemoveMemberAsync(tenantId, userId, ct);
        if (removedUser is null)
        {
            var statusCode = errorCode switch
            {
                "NOT_FOUND" => 404,
                "LAST_ADMIN" => 409,
                _ => 422
            };
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!);
        }

        await auditLogger.SafeLogAsync(tenantId, currentUserId, ctx.GetUserName(), AuditAction.UserDeleted,
            "user", userId, removedUser.Email, $"Removed {removedUser.Name} ({removedUser.Email}) from workspace", ct);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleTransferOwnership(
        HttpContext ctx,
        TransferOwnershipRequest request,
        IUserManagementService userManagementService,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var currentUserId = ctx.GetUserId();

        if (!string.Equals(request.Confirmation, "TRANSFER", StringComparison.Ordinal))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Confirmation must be exactly 'TRANSFER'.");

        var (result, errorCode, errorMessage) = await userManagementService.TransferOwnershipAsync(
            tenantId, currentUserId, request.TargetUserId, ct);

        if (result is null)
        {
            var statusCode = errorCode!.Contains("NOT_FOUND") ? 404 : 422;
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!, "User", request.TargetUserId.ToString());
        }

        await auditLogger.SafeLogAsync(tenantId, currentUserId, ctx.GetUserName(), AuditAction.OwnershipTransferred,
            "user", result.NewAdmin.Id, result.NewAdmin.Email,
            $"Transferred ownership from {result.PreviousAdmin.Name} to {result.NewAdmin.Name}", ct);

        return Results.Ok(new
        {
            PreviousAdmin = new { result.PreviousAdmin.Id, result.PreviousAdmin.Email, Role = "editor" },
            NewAdmin = new { result.NewAdmin.Id, result.NewAdmin.Email, Role = "admin" }
        });
    }
}
