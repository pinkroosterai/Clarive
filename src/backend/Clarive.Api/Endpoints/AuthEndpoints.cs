using System.Security.Cryptography;
using Clarive.Auth.Google;
using Clarive.Api.Helpers;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Microsoft.Extensions.Caching.Distributed;
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

        group
            .MapGet("/github/authorize", HandleGitHubAuthorize)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group
            .MapGet("/github/callback", HandleGitHubCallback)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group
            .MapGet(
                "/github-client-id",
                (IConfiguration config) =>
                    Results.Ok(new { clientId = config["GitHub:ClientId"] ?? "" })
            )
            .AllowAnonymous();

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
        var usersExist = await userRepo.AnyUsersExistAsync(ct);
        if (!IsRegistrationAllowed(configuration) && usersExist)
            return ctx.ErrorResult(
                403,
                "REGISTRATION_DISABLED",
                "New account registration is currently disabled."
            );

        // Anti-spam: honeypot + timing validation (skip for first-user setup)
        if (usersExist)
        {
            var botReason = DetectBot(request);
            if (botReason is not null)
            {
                var logger = loggerFactory.CreateLogger("AuthEndpoints");
                var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                logger.LogWarning("Bot registration detected: {Reason}, IP: {Ip}, Email: {Email}", botReason, ip, request.Email);
                return Results.Created("/api/auth/me", GenerateFakeAuthResponse());
            }
        }

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

    private static async Task<IResult> HandleGitHubAuthorize(
        HttpContext ctx,
        IGitHubAuthService gitHubAuthService,
        IDistributedCache cache,
        IOptions<AppSettings> appSettings
    )
    {
        if (!gitHubAuthService.IsConfigured)
            return ctx.ErrorResult(
                503,
                "GITHUB_AUTH_NOT_CONFIGURED",
                "GitHub authentication is not configured."
            );

        var state = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        await cache.SetStringAsync(
            $"github_oauth_state:{state}",
            "1",
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) }
        );

        var redirectUri = $"{appSettings.Value.FrontendUrl.TrimEnd('/')}/api/auth/github/callback";

        var authorizationUrl = gitHubAuthService.GetAuthorizationUrl(redirectUri, state);
        return Results.Redirect(authorizationUrl);
    }

    private static async Task<IResult> HandleGitHubCallback(
        HttpContext ctx,
        string? code,
        string? state,
        IGitHubAuthService gitHubAuthService,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        IUserRepository userRepo,
        IDistributedCache cache,
        IConfiguration configuration,
        IOptions<AppSettings> appSettings,
        CancellationToken ct
    )
    {
        var frontendUrl = appSettings.Value.FrontendUrl.TrimEnd('/');

        // Validate state (CSRF protection)
        if (string.IsNullOrWhiteSpace(state) || string.IsNullOrWhiteSpace(code))
            return Results.Redirect($"{frontendUrl}/login?error=invalid_request");

        var cacheKey = $"github_oauth_state:{state}";
        var cachedState = await cache.GetStringAsync(cacheKey, ct);
        if (cachedState is null)
            return Results.Redirect($"{frontendUrl}/login?error=invalid_state");

        // Remove state token (one-time use)
        await cache.RemoveAsync(cacheKey, ct);

        if (!gitHubAuthService.IsConfigured)
            return Results.Redirect($"{frontendUrl}/login?error=not_configured");

        var redirectUri = $"{frontendUrl}/api/auth/github/callback";

        // Pre-check: if registration is disabled, verify the GitHub user already has an account
        if (!IsRegistrationAllowed(configuration))
        {
            try
            {
                var gitHubUser = await gitHubAuthService.ExchangeCodeForUserAsync(
                    code,
                    redirectUri,
                    ct
                );
                var existsByGitHub = await userRepo.GetByGitHubIdAsync(gitHubUser.GitHubId, ct);
                var existsByEmail =
                    existsByGitHub ?? await userRepo.GetByEmailAsync(gitHubUser.Email, ct);
                if (existsByEmail is null)
                    return Results.Redirect(
                        $"{frontendUrl}/login?error={Uri.EscapeDataString("REGISTRATION_DISABLED")}"
                    );
            }
            catch (Exception)
            {
                return Results.Redirect(
                    $"{frontendUrl}/login?error={Uri.EscapeDataString("GITHUB_AUTH_FAILED")}"
                );
            }
        }

        var result = await accountService.LoginWithGitHubAsync(code, redirectUri, ct);
        if (result.IsError)
        {
            var errorCode = result.Errors[0].Code;
            return Results.Redirect($"{frontendUrl}/login?error={Uri.EscapeDataString(errorCode)}");
        }

        await LoginSessionHelper.RecordAsync(
            ctx,
            sessionRepo,
            result.Value.User.Id,
            result.Value.RefreshTokenId,
            ct
        );

        // Redirect to frontend completion page with tokens in fragment
        var fragment = string.Join(
            "&",
            $"token={Uri.EscapeDataString(result.Value.AccessToken)}",
            $"refresh={Uri.EscapeDataString(result.Value.RawRefreshToken)}",
            $"isNewUser={result.Value.IsNewUser.ToString().ToLowerInvariant()}"
        );
        return Results.Redirect($"{frontendUrl}/auth/github/complete#{fragment}");
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
        var githubEnabled = !string.IsNullOrWhiteSpace(configuration["GitHub:ClientId"]);
        return Results.Ok(
            new
            {
                isSetupComplete,
                allowRegistration,
                emailEnabled,
                githubEnabled,
            }
        );
    }

    private static bool IsRegistrationAllowed(IConfiguration configuration)
    {
        var value = configuration["App:AllowRegistration"];
        // Default to true if not explicitly set to "false"
        return !string.Equals(value, "false", StringComparison.OrdinalIgnoreCase);
    }

    private const int MinFormCompletionMs = 3000;

    private static string? DetectBot(RegisterRequest request)
    {
        if (!string.IsNullOrEmpty(request.Honeypot))
            return "honeypot";

        if (request.FormLoadedAt is > 0)
        {
            var elapsed = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - request.FormLoadedAt.Value;
            if (elapsed < MinFormCompletionMs)
                return $"timing ({elapsed}ms)";
        }

        return null;
    }

    private static AuthResponse GenerateFakeAuthResponse()
    {
        var fakeId = Guid.NewGuid();
        var fakeToken = $"eyJ{Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))}.{Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))}.{Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))}";
        var fakeRefresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        return new AuthResponse(
            fakeToken,
            fakeRefresh,
            new UserDto(
                fakeId,
                $"user-{fakeId:N}"[..12] + "@clarive.dev",
                "User",
                "editor",
                false,
                false,
                null,
                true,
                false
            ),
            [new WorkspaceDto(Guid.NewGuid(), "Personal", "admin", true, 1, null)]
        );
    }
}
