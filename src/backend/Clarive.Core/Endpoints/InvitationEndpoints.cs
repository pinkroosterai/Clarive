using Clarive.Core.Helpers;
using Clarive.Core.Helpers;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Core.Models.Responses;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Core.Services;
using Clarive.Core.Services.Interfaces;
using static Clarive.Core.Helpers.ResponseMappers;

namespace Clarive.Core.Endpoints;

public static class InvitationEndpoints
{
    public static RouteGroupBuilder MapInvitationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/invitations").WithTags("Invitations");

        group.MapPost("/", HandleCreate).RequireAuthorization("AdminOnly");

        group.MapGet("/{token}/validate", HandleValidate).AllowAnonymous();

        group.MapPost("/{token}/accept", HandleAccept).AllowAnonymous().RequireRateLimiting("auth");

        group.MapPost("/{id:guid}/resend", HandleResend).RequireAuthorization("AdminOnly");

        group.MapDelete("/{id:guid}", HandleRevoke).RequireAuthorization("AdminOnly");

        group.MapGet("/pending", HandleGetPending).RequireAuthorization();

        group.MapGet("/pending/count", HandlePendingCount).RequireAuthorization();

        group.MapPost("/{id:guid}/respond", HandleRespond).RequireAuthorization();

        return group;
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateInvitationRequest request,
        IInvitationService invitationService,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role) || role == UserRole.Admin)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Role must be 'editor' or 'viewer'.");

        var result = await invitationService.CreateAsync(
            ctx.GetTenantId(),
            ctx.GetUserId(),
            ctx.GetUserName(),
            request.Email,
            role,
            ct
        );

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var inv = result.Value.Invitation;
        if (result.Value.IsExistingUser)
        {
            return Results.Created(
                $"/api/invitations/{inv.Id}",
                new
                {
                    inv.Id,
                    inv.Email,
                    Role = inv.Role.ToString().ToLower(),
                    Status = "pending",
                    inv.ExpiresAt,
                    inv.CreatedAt,
                }
            );
        }

        return Results.Created(
            $"/api/invitations/{inv.Id}",
            new
            {
                inv.Id,
                inv.Email,
                Role = inv.Role.ToString().ToLower(),
                inv.ExpiresAt,
                inv.CreatedAt,
            }
        );
    }

    private static async Task<IResult> HandleValidate(
        string token,
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct
    )
    {
        var result = await invitationService.ValidateAsync(token, ct);
        if (result is null)
            return ctx.ErrorResult(
                404,
                "INVITATION_NOT_FOUND",
                "This invitation is invalid or has expired."
            );

        return Results.Ok(
            new
            {
                result.Email,
                result.Role,
                result.WorkspaceName,
            }
        );
    }

    private static async Task<IResult> HandleAccept(
        string token,
        HttpContext ctx,
        AcceptInvitationRequest request,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var result = await accountService.AcceptInvitationAsync(
            token,
            request.Name,
            request.Password,
            ct
        );
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await LoginSessionHelper.RecordAsync(
            ctx,
            sessionRepo,
            result.Value.User.Id,
            result.Value.RefreshTokenId,
            ct
        );

        await auditLogger.SafeLogAsync(
            result.Value.User.TenantId,
            result.Value.User.Id,
            result.Value.User.Name,
            AuditAction.InvitationAccepted,
            "invitation",
            Guid.Empty,
            result.Value.User.Email,
            $"{result.Value.User.Name} accepted invitation",
            ct
        );

        var workspaces = await BuildWorkspaceListAsync(
            membershipRepo,
            tenantRepo,
            result.Value.User.Id,
            ct
        );
        return Results.Created(
            $"/api/auth/me",
            new AuthResponse(
                result.Value.AccessToken,
                result.Value.RawRefreshToken,
                ToUserDto(result.Value.User),
                workspaces
            )
        );
    }

    private static async Task<IResult> HandleResend(
        Guid id,
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct
    )
    {
        var result = await invitationService.ResendAsync(
            ctx.GetTenantId(),
            id,
            ctx.GetUserName(),
            ct
        );
        if (result is null)
            return ctx.ErrorResult(
                404,
                "NOT_FOUND",
                "Invitation not found.",
                "Invitation",
                id.ToString()
            );

        var inv = result.Invitation;
        return Results.Ok(
            new
            {
                inv.Id,
                inv.Email,
                Role = inv.Role.ToString().ToLower(),
                inv.ExpiresAt,
                inv.CreatedAt,
            }
        );
    }

    private static async Task<IResult> HandleRevoke(
        Guid id,
        HttpContext ctx,
        IInvitationService invitationService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var invitation = await invitationService.RevokeAsync(ctx.GetTenantId(), id, ct);
        if (invitation is null)
            return ctx.ErrorResult(
                404,
                "NOT_FOUND",
                "Invitation not found.",
                "Invitation",
                id.ToString()
            );

        await auditLogger.SafeLogAsync(
            ctx.GetTenantId(),
            ctx.GetUserId(),
            ctx.GetUserName(),
            AuditAction.InvitationRevoked,
            "invitation",
            id,
            invitation.Email,
            $"Revoked invitation for {invitation.Email}",
            ct
        );

        return Results.NoContent();
    }

    private static async Task<IResult> HandleGetPending(
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct
    )
    {
        var invitations = await invitationService.GetPendingAsync(ctx.GetUserId(), ct);
        return Results.Ok(new { invitations });
    }

    private static async Task<IResult> HandlePendingCount(
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct
    )
    {
        var count = await invitationService.GetPendingCountAsync(ctx.GetUserId(), ct);
        return Results.Ok(new { count });
    }

    private static async Task<IResult> HandleRespond(
        Guid id,
        HttpContext ctx,
        RespondToInvitationRequest request,
        IInvitationService invitationService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var userId = ctx.GetUserId();
        var userName = ctx.GetUserName();

        var result = await invitationService.RespondAsync(userId, id, request.Accept, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        if (!result.Value.Accepted)
        {
            await auditLogger.SafeLogAsync(
                Guid.Empty,
                userId,
                userName,
                AuditAction.InvitationDeclined,
                "invitation",
                id,
                "",
                $"{userName} declined invitation to workspace",
                ct
            );

            return Results.Ok(new { message = "Invitation declined" });
        }

        await auditLogger.SafeLogAsync(
            result.Value.Membership!.TenantId,
            userId,
            userName,
            AuditAction.InvitationAccepted,
            "invitation",
            id,
            "",
            $"{userName} accepted invitation as {result.Value.Membership.Role.ToString().ToLower()}",
            ct
        );

        return Results.Ok(
            new
            {
                message = $"You have joined {result.Value.WorkspaceName}",
                workspace = new WorkspaceDto(
                    result.Value.Membership.TenantId,
                    result.Value.WorkspaceName ?? "Unknown",
                    result.Value.Membership.Role.ToString().ToLower(),
                    false,
                    result.Value.MemberCount ?? 0,
                    result.Value.AvatarUrl
                ),
            }
        );
    }
}
