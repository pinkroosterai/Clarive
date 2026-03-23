using Clarive.Api.Helpers;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Api.Endpoints;

public static class UserEndpoints
{
    public static RouteGroupBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").WithTags("Users").RequireAuthorization();

        group.MapGet("/", HandleList);

        group.MapPatch("/{userId:guid}/role", HandleChangeRole).RequireAuthorization("AdminOnly");

        group.MapDelete("/{userId:guid}", HandleDelete).RequireAuthorization("AdminOnly");

        group
            .MapPost("/transfer-ownership", HandleTransferOwnership)
            .RequireAuthorization("AdminOnly");

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IUserManagementService userManagementService,
        CancellationToken ct,
        int page = 1,
        int pageSize = 50
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await userManagementService.ListMembersAsync(tenantId, page, pageSize, ct);
        return Results.Ok(
            new
            {
                items = result.Items,
                total = result.Total,
                page = result.Page,
                pageSize = result.PageSize,
            }
        );
    }

    private static async Task<IResult> HandleChangeRole(
        Guid userId,
        HttpContext ctx,
        UpdateUserRoleRequest request,
        IUserManagementService userManagementService,
        IAuditLogger auditLogger,
        IEmailService emailService,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var currentUserId = ctx.GetUserId();

        if (userId == currentUserId)
            return ctx.ErrorResult(
                409,
                "CANNOT_CHANGE_OWN_ROLE",
                "Cannot change your own role.",
                "User",
                userId.ToString()
            );

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            return ctx.ErrorResult(
                422,
                "VALIDATION_ERROR",
                "Role must be 'admin', 'editor', or 'viewer'."
            );

        var result = await userManagementService.ChangeRoleAsync(tenantId, userId, role, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "User", userId.ToString());

        await auditLogger.SafeLogAsync(
            tenantId,
            currentUserId,
            ctx.GetUserName(),
            AuditAction.UserRoleChanged,
            "user",
            userId,
            result.Value.User.Email,
            $"Changed role from {result.Value.OldRole} to {result.Value.NewRole}",
            ct
        );

        // Notify the affected user
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is not null)
            _ = emailService.SendRoleChangedAsync(result.Value.User.Email, result.Value.User.Name, tenant.Name, result.Value.OldRole, result.Value.NewRole, CancellationToken.None);

        return Results.Ok(
            new
            {
                result.Value.User.Id,
                result.Value.User.Email,
                result.Value.User.Name,
                Role = result.Value.NewRole,
                result.Value.User.CreatedAt,
            }
        );
    }

    private static async Task<IResult> HandleDelete(
        Guid userId,
        HttpContext ctx,
        IUserManagementService userManagementService,
        IAuditLogger auditLogger,
        IEmailService emailService,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var currentUserId = ctx.GetUserId();

        if (userId == currentUserId)
            return ctx.ErrorResult(
                409,
                "CANNOT_DELETE_SELF",
                "Cannot delete your own account.",
                "User",
                userId.ToString()
            );

        var result = await userManagementService.RemoveMemberAsync(tenantId, userId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await auditLogger.SafeLogAsync(
            tenantId,
            currentUserId,
            ctx.GetUserName(),
            AuditAction.UserDeleted,
            "user",
            userId,
            result.Value.Email,
            $"Removed {result.Value.Name} ({result.Value.Email}) from workspace",
            ct
        );

        // Notify the removed user
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is not null)
            _ = emailService.SendRemovedFromWorkspaceAsync(result.Value.Email, result.Value.Name, tenant.Name, CancellationToken.None);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleTransferOwnership(
        HttpContext ctx,
        TransferOwnershipRequest request,
        IUserManagementService userManagementService,
        IAuditLogger auditLogger,
        IEmailService emailService,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var currentUserId = ctx.GetUserId();

        if (!string.Equals(request.Confirmation, "TRANSFER", StringComparison.Ordinal))
            return ctx.ErrorResult(
                422,
                "VALIDATION_ERROR",
                "Confirmation must be exactly 'TRANSFER'."
            );

        var result = await userManagementService.TransferOwnershipAsync(
            tenantId,
            currentUserId,
            request.TargetUserId,
            ct
        );

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "User", request.TargetUserId.ToString());

        await auditLogger.SafeLogAsync(
            tenantId,
            currentUserId,
            ctx.GetUserName(),
            AuditAction.OwnershipTransferred,
            "user",
            result.Value.NewAdmin.Id,
            result.Value.NewAdmin.Email,
            $"Transferred ownership from {result.Value.PreviousAdmin.Name} to {result.Value.NewAdmin.Name}",
            ct
        );

        // Notify both parties
        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        if (tenant is not null)
        {
            var fromName = result.Value.PreviousAdmin.Name;
            var toName = result.Value.NewAdmin.Name;
            _ = emailService.SendOwnershipTransferredAsync(result.Value.PreviousAdmin.Email, fromName, tenant.Name, fromName, toName, CancellationToken.None);
            _ = emailService.SendOwnershipTransferredAsync(result.Value.NewAdmin.Email, toName, tenant.Name, fromName, toName, CancellationToken.None);
        }

        return Results.Ok(
            new
            {
                PreviousAdmin = new
                {
                    result.Value.PreviousAdmin.Id,
                    result.Value.PreviousAdmin.Email,
                    Role = "editor",
                },
                NewAdmin = new
                {
                    result.Value.NewAdmin.Id,
                    result.Value.NewAdmin.Email,
                    Role = "admin",
                },
            }
        );
    }
}
