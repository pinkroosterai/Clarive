using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Options;
using static Clarive.Api.Helpers.ResponseMappers;

namespace Clarive.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", HandleLogin).AllowAnonymous().RequireRateLimiting("auth");

        group
            .MapPost("/register", HandleRegister)
            .AllowAnonymous()
            .RequireRateLimiting("strict-auth");

        group.MapPost("/refresh", HandleRefresh).AllowAnonymous().RequireRateLimiting("auth");

        group
            .MapPost("/verify-email", HandleVerifyEmail)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group
            .MapPost("/resend-verification", HandleResendVerification)
            .RequireAuthorization()
            .RequireRateLimiting("auth");

        group
            .MapPost("/forgot-password", HandleForgotPassword)
            .AllowAnonymous()
            .RequireRateLimiting("strict-auth");

        group
            .MapPost("/reset-password", HandleResetPassword)
            .AllowAnonymous()
            .RequireRateLimiting("strict-auth");

        group.MapPost("/google", HandleGoogleAuth).AllowAnonymous().RequireRateLimiting("auth");

        group.MapGet("/setup-status", HandleSetupStatus).AllowAnonymous();

        group
            .MapGet(
                "/google-client-id",
                (IConfiguration config) =>
                    Results.Ok(new { clientId = config["Google:ClientId"] ?? "" })
            )
            .AllowAnonymous();

        // Avatar serving (public, no auth required)
        app.MapGet("/api/users/{userId:guid}/avatar", HandleGetAvatar)
            .WithTags("Users")
            .AllowAnonymous();

        return group;
    }

    private static async Task<IResult> HandleGetAvatar(
        Guid userId,
        IUserRepository userRepo,
        IAvatarService avatarService,
        CancellationToken ct
    )
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return Results.NotFound();

        var absolutePath = avatarService.GetAbsolutePath(user.AvatarPath);
        if (absolutePath is null)
            return Results.NotFound();

        return Results.File(
            absolutePath,
            "image/webp",
            enableRangeProcessing: false,
            entityTag: null,
            lastModified: File.GetLastWriteTimeUtc(absolutePath)
        );
    }

    private static async Task<IResult> HandleLogin(
        HttpContext ctx,
        LoginRequest request,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Email and password are required.");

        var result = await accountService.LoginAsync(request.Email, request.Password, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await LoginSessionHelper.RecordAsync(
            ctx,
            sessionRepo,
            result.Value.User.Id,
            result.Value.RefreshTokenId,
            ct
        );

        var workspaces = await BuildWorkspaceListAsync(
            membershipRepo,
            tenantRepo,
            result.Value.User.Id,
            ct
        );
        return Results.Ok(
            new AuthResponse(
                result.Value.AccessToken,
                result.Value.RawRefreshToken,
                ToUserDto(result.Value.User),
                workspaces
            )
        );
    }

    private static async Task<IResult> HandleRegister(
        HttpContext ctx,
        RegisterRequest request,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        IUserRepository userRepo,
        IEmailService emailService,
        IOptions<AppSettings> appSettings,
        IConfiguration configuration,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        // Block registration if disabled (always allow first user for initial setup)
        if (!IsRegistrationAllowed(configuration) && await userRepo.AnyUsersExistAsync(ct))
            return ctx.ErrorResult(
                403,
                "REGISTRATION_DISABLED",
                "New account registration is currently disabled."
            );

        var result = await accountService.RegisterAsync(
            request.Email,
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

        // Send verification email (fire-and-forget) — skip for first user (auto-verified super admin)
        if (result.Value.RawVerificationToken is not null)
        {
            var verifyUrl =
                $"{appSettings.Value.FrontendUrl}/verify-email?token={result.Value.RawVerificationToken}";
            var emailLogger = loggerFactory.CreateLogger("AuthEndpoints");
            _ = emailService
                .SendVerificationEmailAsync(
                    result.Value.User.Email,
                    result.Value.User.Name,
                    verifyUrl,
                    CancellationToken.None
                )
                .ContinueWith(
                    t =>
                        emailLogger.LogWarning(
                            t.Exception,
                            "Failed to send verification email to {Email}",
                            result.Value.User.Email
                        ),
                    TaskContinuationOptions.OnlyOnFaulted
                );
        }

        var workspaces = await BuildWorkspaceListAsync(
            membershipRepo,
            tenantRepo,
            result.Value.User.Id,
            ct
        );
        return Results.Created(
            "/api/auth/me",
            new AuthResponse(
                result.Value.AccessToken,
                result.Value.RawRefreshToken,
                ToUserDto(result.Value.User),
                workspaces
            )
        );
    }

    private static async Task<IResult> HandleRefresh(
        HttpContext ctx,
        RefreshTokenRequest request,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Refresh token is required.");

        var result = await accountService.RefreshTokensAsync(request.RefreshToken, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await LoginSessionHelper.RecordAsync(
            ctx,
            sessionRepo,
            result.Value.User.Id,
            result.Value.NewRefreshTokenId,
            ct
        );

        var workspaces = await BuildWorkspaceListAsync(
            membershipRepo,
            tenantRepo,
            result.Value.User.Id,
            ct
        );
        return Results.Ok(
            new AuthResponse(
                result.Value.AccessToken,
                result.Value.RawRefreshToken,
                ToUserDto(result.Value.User),
                workspaces
            )
        );
    }

    private static async Task<IResult> HandleVerifyEmail(
        HttpContext ctx,
        VerifyEmailRequest request,
        IAuthService authService,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Token is required.");

        var result = await authService.VerifyEmailAsync(request.Token, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new { message = result.Value });
    }

    private static async Task<IResult> HandleResendVerification(
        HttpContext ctx,
        IAuthService authService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await authService.ResendVerificationAsync(tenantId, userId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new { message = result.Value });
    }

    private static async Task<IResult> HandleForgotPassword(
        ForgotPasswordRequest request,
        IAuthService authService,
        CancellationToken ct
    )
    {
        await authService.ForgotPasswordAsync(request.Email, ct);

        // Always return 200 to prevent email enumeration
        return Results.Ok(new { message = "If an account exists, a reset email has been sent." });
    }

    private static async Task<IResult> HandleResetPassword(
        HttpContext ctx,
        ResetPasswordRequest request,
        IAuthService authService,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Token is required.");

        var result = await authService.ResetPasswordAsync(request.Token, request.NewPassword, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new { message = result.Value });
    }

    private static async Task<IResult> HandleGoogleAuth(
        HttpContext ctx,
        GoogleAuthRequest request,
        IGoogleAuthService googleAuthService,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        IUserRepository userRepo,
        IConfiguration configuration,
        CancellationToken ct
    )
    {
        if (!googleAuthService.IsConfigured)
            return ctx.ErrorResult(
                503,
                "GOOGLE_AUTH_NOT_CONFIGURED",
                "Google authentication is not configured."
            );

        if (string.IsNullOrWhiteSpace(request.IdToken))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "ID token is required.");

        // Pre-check: if registration is disabled, verify the Google user already has an account
        if (!IsRegistrationAllowed(configuration))
        {
            try
            {
                var googleUser = await googleAuthService.ValidateIdTokenAsync(
                    request.IdToken,
                    request.Nonce,
                    ct
                );
                var existsByGoogle = await userRepo.GetByGoogleIdAsync(googleUser.GoogleId, ct);
                var existsByEmail =
                    existsByGoogle ?? await userRepo.GetByEmailAsync(googleUser.Email, ct);
                if (existsByEmail is null)
                    return ctx.ErrorResult(
                        403,
                        "REGISTRATION_DISABLED",
                        "New account registration is currently disabled."
                    );
            }
            catch (Exception)
            {
                return ctx.ErrorResult(
                    401,
                    "INVALID_GOOGLE_TOKEN",
                    "Google ID token is invalid or expired."
                );
            }
        }

        var result = await accountService.LoginWithGoogleAsync(request.IdToken, request.Nonce, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await LoginSessionHelper.RecordAsync(
            ctx,
            sessionRepo,
            result.Value.User.Id,
            result.Value.RefreshTokenId,
            ct
        );

        var workspaces = await BuildWorkspaceListAsync(
            membershipRepo,
            tenantRepo,
            result.Value.User.Id,
            ct
        );
        return Results.Ok(
            new
            {
                token = result.Value.AccessToken,
                refreshToken = result.Value.RawRefreshToken,
                user = ToUserDto(result.Value.User),
                isNewUser = result.Value.IsNewUser,
                workspaces,
            }
        );
    }

    private static async Task<IResult> HandleSetupStatus(
        IUserRepository userRepo,
        IConfiguration configuration,
        CancellationToken ct
    )
    {
        var isSetupComplete = await userRepo.AnyUsersExistAsync(ct);
        var allowRegistration = !isSetupComplete || IsRegistrationAllowed(configuration);
        var emailProvider = configuration["Email:Provider"] ?? "none";
        var emailEnabled = !string.Equals(
            emailProvider,
            "none",
            StringComparison.OrdinalIgnoreCase
        );
        return Results.Ok(
            new
            {
                isSetupComplete,
                allowRegistration,
                emailEnabled,
            }
        );
    }

    private static bool IsRegistrationAllowed(IConfiguration configuration)
    {
        var value = configuration["App:AllowRegistration"];
        // Default to true if not explicitly set to "false"
        return !string.Equals(value, "false", StringComparison.OrdinalIgnoreCase);
    }
}
