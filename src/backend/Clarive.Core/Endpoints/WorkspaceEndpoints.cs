using Clarive.Auth.Jwt;
using Clarive.Domain.Entities;
using Clarive.Core.Helpers;
using Clarive.Core.Helpers;
using Clarive.Domain.Enums;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Core.Models.Responses;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services.Interfaces;
using Serilog;
using static Clarive.Core.Helpers.ResponseMappers;

namespace Clarive.Core.Endpoints;

public static class WorkspaceEndpoints
{
    public static RouteGroupBuilder MapWorkspaceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Workspaces").RequireAuthorization();

        group.MapPost("/auth/switch-workspace", HandleSwitchWorkspace);
        group.MapGet("/workspaces", HandleList);
        group.MapPost("/workspaces/{tenantId:guid}/leave", HandleLeave);

        return group;
    }

    private static async Task<IResult> HandleSwitchWorkspace(
        HttpContext ctx,
        SwitchWorkspaceRequest request,
        ITenantMembershipRepository membershipRepo,
        IUserRepository userRepo,
        ITenantRepository tenantRepo,
        IRefreshTokenRepository refreshTokenRepo,
        JwtService jwtService,
        CancellationToken ct
    )
    {
        var userId = ctx.GetUserId();

        var membership = await membershipRepo.GetAsync(userId, request.TenantId, ct);
        if (membership is null)
            return ctx.ErrorResult(403, "NOT_A_MEMBER", "You are not a member of this workspace.");

        var tenant = await tenantRepo.GetByIdAsync(request.TenantId, ct);
        if (tenant is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Workspace not found.");

        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.");

        user.TenantId = request.TenantId;
        user.Role = membership.Role;
        await userRepo.UpdateAsync(user, ct);

        var accessToken = jwtService.GenerateToken(user, request.TenantId, membership.Role);

        // Issue a new refresh token so the old one (bound to previous tenant context)
        // cannot regenerate a JWT with stale tenant claims.
        var (rawRefresh, refreshHash) = jwtService.GenerateRefreshToken();
        await refreshTokenRepo.CreateAsync(
            new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = refreshHash,
                ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        return Results.Ok(
            new
            {
                token = accessToken,
                refreshToken = rawRefresh,
                user = ToUserDto(user),
            }
        );
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var userId = ctx.GetUserId();
        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, userId, ct);
        return Results.Ok(new { workspaces });
    }

    private static async Task<IResult> HandleLeave(
        HttpContext ctx,
        Guid tenantId,
        ITenantMembershipRepository membershipRepo,
        IUserRepository userRepo,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var userId = ctx.GetUserId();

        var membership = await membershipRepo.GetAsync(userId, tenantId, ct);
        if (membership is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "You are not a member of this workspace.");

        if (membership.IsPersonal)
            return ctx.ErrorResult(
                403,
                "CANNOT_LEAVE_PERSONAL",
                "Cannot leave your personal workspace."
            );

        if (membership.Role == UserRole.Admin)
        {
            var adminCount = await membershipRepo.CountAdminsAsync(tenantId, ct);
            if (adminCount <= 1)
                return ctx.ErrorResult(
                    409,
                    "LAST_ADMIN",
                    "You are the only admin. Transfer ownership before leaving."
                );
        }

        await membershipRepo.DeleteAsync(userId, tenantId, ct);

        // If the user's active workspace was this one, switch to personal
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is not null && user.TenantId == tenantId)
        {
            var memberships = await membershipRepo.GetByUserIdAsync(userId, ct);
            var personal = memberships.FirstOrDefault(m => m.IsPersonal);
            if (personal is not null)
            {
                user.TenantId = personal.TenantId;
                user.Role = personal.Role;
                await userRepo.UpdateAsync(user, ct);
            }
        }

        await SafeLogAsync(
            auditLogger,
            tenantId,
            userId,
            ctx.GetUserName(),
            AuditAction.MemberRemoved,
            "User",
            userId,
            ctx.GetUserName(),
            "Left workspace",
            ct
        );

        return Results.NoContent();
    }

    private static async Task SafeLogAsync(
        IAuditLogger auditLogger,
        Guid tenantId,
        Guid userId,
        string userName,
        AuditAction action,
        string entityType,
        Guid entityId,
        string entityTitle,
        string? details,
        CancellationToken ct
    )
    {
        try
        {
            await auditLogger.LogAsync(
                tenantId,
                userId,
                userName,
                action,
                entityType,
                entityId,
                entityTitle,
                details,
                ct
            );
        }
        catch (Exception ex)
        {
            Log.Warning(
                ex,
                "Audit logging failed for {Action} on {EntityType} {EntityId}",
                action,
                entityType,
                entityId
            );
        }
    }
}
