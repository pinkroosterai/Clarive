using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Endpoints;

public static class ProfileEndpoints
{
    public static RouteGroupBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profile")
            .WithTags("Profile")
            .RequireAuthorization();

        group.MapGet("/me", HandleGetMe);
        group.MapPatch("/", HandleUpdateProfile);
        group.MapPost("/complete-onboarding", HandleCompleteOnboarding);

        group.MapPost("/avatar", HandleUploadAvatar)
            .DisableAntiforgery();

        group.MapDelete("/avatar", HandleDeleteAvatar);

        group.MapGet("/sessions", HandleGetSessions);
        group.MapDelete("/sessions/{sessionId:guid}", HandleRevokeSession);
        group.MapPost("/sessions/revoke-others", HandleRevokeOtherSessions);

        return group;
    }

    private static async Task<IResult> HandleGetMe(
        HttpContext ctx,
        IUserRepository userRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        var workspaces = await AuthEndpoints.BuildWorkspaceListAsync(membershipRepo, tenantRepo, userId, ct);
        var dto = AuthEndpoints.ToDto(user);
        return Results.Ok(new
        {
            dto.Id, dto.Email, dto.Name, dto.Role, dto.EmailVerified, dto.OnboardingCompleted, dto.AvatarUrl,
            dto.HasPassword, dto.IsSuperUser, dto.ThemePreference, Workspaces = workspaces
        });
    }

    private static async Task<IResult> HandleUpdateProfile(
        HttpContext ctx,
        UpdateProfileRequest request,
        IProfileService profileService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var (user, errorCode, message) = await profileService.UpdateProfileAsync(tenantId, userId, request, ct);
        if (user is null)
        {
            var statusCode = errorCode switch
            {
                "NOT_FOUND" => 404,
                "EMAIL_EXISTS" => 409,
                _ => 422
            };
            return ctx.ErrorResult(statusCode, errorCode!, message!);
        }

        return Results.Ok(AuthEndpoints.ToDto(user));
    }

    private static async Task<IResult> HandleCompleteOnboarding(
        HttpContext ctx,
        IProfileService profileService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var (success, errorCode, message) = await profileService.CompleteOnboardingAsync(tenantId, userId, ct);
        if (!success)
            return ctx.ErrorResult(404, errorCode!, message!);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleUploadAvatar(
        HttpContext ctx,
        IUserRepository userRepo,
        IAvatarService avatarService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        if (!ctx.Request.HasFormContentType || ctx.Request.Form.Files.Count == 0)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "No file uploaded.");

        var file = ctx.Request.Form.Files[0];

        if (file.Length == 0)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Uploaded file is empty.");

        if (file.Length > 3 * 1024 * 1024)
            return ctx.ErrorResult(413, "FILE_TOO_LARGE", "Image exceeds the 3 MB size limit.");

        try
        {
            await using var stream = file.OpenReadStream();
            var relativePath = await avatarService.SaveAsync(userId, stream, file.ContentType, ct);

            user.AvatarPath = relativePath;
            await userRepo.UpdateAsync(user, ct);

            return Results.Ok(new { avatarUrl = AvatarHelpers.UserAvatarUrl(user) });
        }
        catch (InvalidOperationException ex)
        {
            return ctx.ErrorResult(422, "VALIDATION_ERROR", ex.Message);
        }
    }

    private static async Task<IResult> HandleDeleteAvatar(
        HttpContext ctx,
        IUserRepository userRepo,
        IAvatarService avatarService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        await avatarService.DeleteAsync(userId, ct);
        user.AvatarPath = null;
        await userRepo.UpdateAsync(user, ct);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleGetSessions(
        HttpContext ctx,
        ILoginSessionRepository sessionRepo,
        IRefreshTokenRepository refreshTokenRepo,
        string? currentRefreshToken,
        CancellationToken ct)
    {
        var userId = ctx.GetUserId();
        var sessions = await sessionRepo.GetByUserAsync(userId, ct: ct);

        Guid? currentRefreshTokenId = null;
        if (!string.IsNullOrWhiteSpace(currentRefreshToken))
        {
            var hash = JwtService.HashRefreshToken(currentRefreshToken);
            var token = await refreshTokenRepo.GetByHashAsync(hash, ct);
            currentRefreshTokenId = token?.Id;
        }

        var dtos = sessions.Select(s => new SessionDto(
            s.Id,
            s.IpAddress,
            s.Browser,
            s.Os,
            s.CreatedAt,
            currentRefreshTokenId.HasValue && s.RefreshTokenId == currentRefreshTokenId.Value
        )).ToList();

        return Results.Ok(dtos);
    }

    private static async Task<IResult> HandleRevokeSession(
        HttpContext ctx,
        Guid sessionId,
        ILoginSessionRepository sessionRepo,
        CancellationToken ct)
    {
        var userId = ctx.GetUserId();
        var revoked = await sessionRepo.RevokeAsync(userId, sessionId, ct);

        if (!revoked)
            return ctx.ErrorResult(404, "NOT_FOUND", "Session not found.");

        return Results.NoContent();
    }

    private static async Task<IResult> HandleRevokeOtherSessions(
        HttpContext ctx,
        ILoginSessionRepository sessionRepo,
        IRefreshTokenRepository refreshTokenRepo,
        string? currentRefreshToken,
        CancellationToken ct)
    {
        var userId = ctx.GetUserId();

        if (string.IsNullOrWhiteSpace(currentRefreshToken))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Current refresh token is required to identify your session.");

        var hash = JwtService.HashRefreshToken(currentRefreshToken);
        var token = await refreshTokenRepo.GetByHashAsync(hash, ct);

        if (token is null || token.UserId != userId)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Invalid refresh token.");

        var revoked = await sessionRepo.RevokeAllExceptAsync(userId, token.Id, ct);
        return Results.Ok(new { revoked });
    }
}
