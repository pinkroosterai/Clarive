using Clarive.Api.Helpers;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Auth;
using Clarive.Api.Models.Entities;
using static Clarive.Api.Helpers.ResponseMappers;

namespace Clarive.Api.Endpoints;

public static class InvitationEndpoints
{
    public static RouteGroupBuilder MapInvitationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/invitations")
            .WithTags("Invitations");

        group.MapPost("/", HandleCreate)
            .RequireAuthorization("AdminOnly");

        group.MapGet("/{token}/validate", HandleValidate)
            .AllowAnonymous();

        group.MapPost("/{token}/accept", HandleAccept)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group.MapPost("/{id:guid}/resend", HandleResend)
            .RequireAuthorization("AdminOnly");

        group.MapDelete("/{id:guid}", HandleRevoke)
            .RequireAuthorization("AdminOnly");

        group.MapGet("/pending", HandleGetPending)
            .RequireAuthorization();

        group.MapGet("/pending/count", HandlePendingCount)
            .RequireAuthorization();

        group.MapPost("/{id:guid}/respond", HandleRespond)
            .RequireAuthorization();

        return group;
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateInvitationRequest request,
        IInvitationService invitationService,
        CancellationToken ct)
    {
        if (Validator.RequireValidEmail(request.Email) is { } emailErr) return emailErr;

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role) || role == UserRole.Admin)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Role must be 'editor' or 'viewer'.");

        var (result, errorCode, errorMessage) = await invitationService.CreateAsync(
            ctx.GetTenantId(), ctx.GetUserId(), ctx.GetUserName(), request.Email, role, ct);

        if (result is null)
        {
            var statusCode = errorCode == "ALREADY_MEMBER" || errorCode == "INVITATION_EXISTS" ? 409 : 422;
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!);
        }

        var inv = result.Invitation;
        if (result.IsExistingUser)
        {
            return Results.Created($"/api/invitations/{inv.Id}", new
            {
                inv.Id,
                inv.Email,
                Role = inv.Role.ToString().ToLower(),
                Status = "pending",
                inv.ExpiresAt,
                inv.CreatedAt
            });
        }

        return Results.Created($"/api/invitations/{inv.Id}", new
        {
            inv.Id,
            inv.Email,
            Role = inv.Role.ToString().ToLower(),
            inv.ExpiresAt,
            inv.CreatedAt
        });
    }

    private static async Task<IResult> HandleValidate(
        string token,
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct)
    {
        var result = await invitationService.ValidateAsync(token, ct);
        if (result is null)
            return ctx.ErrorResult(404, "INVITATION_NOT_FOUND", "This invitation is invalid or has expired.");

        return Results.Ok(new { result.Email, result.Role, result.WorkspaceName });
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
        CancellationToken ct)
    {
        if (Validator.RequireString(request.Name, "Name") is { } nameErr) return nameErr;
        if (Validator.RequirePassword(request.Password) is { } pwErr) return pwErr;

        var result = await accountService.AcceptInvitationAsync(token, request.Name, request.Password, ct);
        if (result is null)
            return ctx.ErrorResult(404, "INVITATION_NOT_FOUND", "This invitation is invalid or has expired.");

        await LoginSessionHelper.RecordAsync(ctx, sessionRepo, result.User.Id, result.RefreshTokenId, ct);

        await auditLogger.SafeLogAsync(result.User.TenantId, result.User.Id, result.User.Name, AuditAction.InvitationAccepted,
            "invitation", Guid.Empty, result.User.Email, $"{result.User.Name} accepted invitation", ct);

        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, result.User.Id, ct);
        return Results.Created($"/api/auth/me", new AuthResponse(result.AccessToken, result.RawRefreshToken, ToUserDto(result.User), workspaces));
    }

    private static async Task<IResult> HandleResend(
        Guid id,
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct)
    {
        var result = await invitationService.ResendAsync(ctx.GetTenantId(), id, ctx.GetUserName(), ct);
        if (result is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Invitation not found.", "Invitation", id.ToString());

        var inv = result.Invitation;
        return Results.Ok(new
        {
            inv.Id,
            inv.Email,
            Role = inv.Role.ToString().ToLower(),
            inv.ExpiresAt,
            inv.CreatedAt
        });
    }

    private static async Task<IResult> HandleRevoke(
        Guid id,
        HttpContext ctx,
        IInvitationService invitationService,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var invitation = await invitationService.RevokeAsync(ctx.GetTenantId(), id, ct);
        if (invitation is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Invitation not found.", "Invitation", id.ToString());

        await auditLogger.SafeLogAsync(ctx.GetTenantId(), ctx.GetUserId(), ctx.GetUserName(), AuditAction.InvitationRevoked,
            "invitation", id, invitation.Email, $"Revoked invitation for {invitation.Email}", ct);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleGetPending(
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct)
    {
        var invitations = await invitationService.GetPendingAsync(ctx.GetUserId(), ct);
        return Results.Ok(new { invitations });
    }

    private static async Task<IResult> HandlePendingCount(
        HttpContext ctx,
        IInvitationService invitationService,
        CancellationToken ct)
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
        CancellationToken ct)
    {
        var userId = ctx.GetUserId();
        var userName = ctx.GetUserName();

        var (result, errorCode, errorMessage) = await invitationService.RespondAsync(userId, id, request.Accept, ct);

        if (result is null)
        {
            var statusCode = errorCode == "ALREADY_MEMBER" ? 409 : 404;
            return ctx.ErrorResult(statusCode, errorCode!, errorMessage!);
        }

        if (!result.Accepted)
        {
            await auditLogger.SafeLogAsync(Guid.Empty, userId, userName, AuditAction.InvitationDeclined,
                "invitation", id, "", $"{userName} declined invitation to workspace", ct);

            return Results.Ok(new { message = "Invitation declined" });
        }

        await auditLogger.SafeLogAsync(result.Membership!.TenantId, userId, userName, AuditAction.InvitationAccepted,
            "invitation", id, "", $"{userName} accepted invitation as {result.Membership.Role.ToString().ToLower()}", ct);

        return Results.Ok(new
        {
            message = $"You have joined {result.WorkspaceName}",
            workspace = new WorkspaceDto(
                result.Membership.TenantId,
                result.WorkspaceName ?? "Unknown",
                result.Membership.Role.ToString().ToLower(),
                false,
                result.MemberCount ?? 0,
                result.AvatarUrl)
        });
    }

}
