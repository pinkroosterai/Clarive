using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Models.Results;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Microsoft.Extensions.Options;
using Clarive.Api.Models.Enums;

namespace Clarive.Api.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth");

        group.MapPost("/login", HandleLogin)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group.MapPost("/register", HandleRegister)
            .AllowAnonymous()
            .RequireRateLimiting("strict-auth");

        group.MapPost("/refresh", HandleRefresh)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group.MapPost("/verify-email", HandleVerifyEmail)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group.MapPost("/resend-verification", HandleResendVerification)
            .RequireAuthorization()
            .RequireRateLimiting("auth");

        group.MapPost("/forgot-password", HandleForgotPassword)
            .AllowAnonymous()
            .RequireRateLimiting("strict-auth");

        group.MapPost("/reset-password", HandleResetPassword)
            .AllowAnonymous()
            .RequireRateLimiting("strict-auth");

        group.MapPost("/google", HandleGoogleAuth)
            .AllowAnonymous()
            .RequireRateLimiting("auth");

        group.MapGet("/setup-status", HandleSetupStatus)
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
        CancellationToken ct)
    {
        var user = await userRepo.GetByIdCrossTenantsAsync(userId, ct);
        if (user is null)
            return Results.NotFound();

        var absolutePath = avatarService.GetAbsolutePath(user.AvatarPath);
        if (absolutePath is null)
            return Results.NotFound();

        return Results.File(absolutePath, "image/webp",
            enableRangeProcessing: false,
            entityTag: null,
            lastModified: File.GetLastWriteTimeUtc(absolutePath));
    }

    private static async Task<IResult> HandleLogin(
        HttpContext ctx,
        LoginRequest request,
        IUserRepository userRepo,
        IRefreshTokenRepository refreshTokenRepo,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        JwtService jwtService,
        PasswordHasher passwordHasher,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Email and password are required.");

        var user = await userRepo.GetByEmailAsync(request.Email, ct);
        if (user is null || user.PasswordHash is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
            return ctx.ErrorResult(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");

        var accessToken = jwtService.GenerateToken(user);
        var (rawRefresh, refreshHash) = jwtService.GenerateRefreshToken();

        var refreshTokenId = Guid.NewGuid();
        await refreshTokenRepo.CreateAsync(new RefreshToken
        {
            Id = refreshTokenId,
            UserId = user.Id,
            TokenHash = refreshHash,
            ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await LoginSessionHelper.RecordAsync(ctx, sessionRepo, user.Id, refreshTokenId, ct);

        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, user.Id, ct);
        return Results.Ok(new AuthResponse(accessToken, rawRefresh, ToDto(user), workspaces));
    }

    private static async Task<IResult> HandleRegister(
        HttpContext ctx,
        RegisterRequest request,
        IAccountService accountService,
        IRefreshTokenRepository refreshTokenRepo,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        IUserRepository userRepo,
        IEmailService emailService,
        IOptions<AppSettings> appSettings,
        IConfiguration configuration,
        JwtService jwtService,
        CancellationToken ct)
    {
        if (Validator.RequireValidEmail(request.Email) is { } emailErr) return emailErr;
        if (Validator.RequireString(request.Name, "Name") is { } nameErr) return nameErr;
        if (Validator.RequirePassword(request.Password) is { } pwErr) return pwErr;

        // Block registration if disabled (always allow first user for initial setup)
        if (!IsRegistrationAllowed(configuration) && await userRepo.AnyUsersExistAsync(ct))
            return ctx.ErrorResult(403, "REGISTRATION_DISABLED", "New account registration is currently disabled.");

        var result = await accountService.RegisterAsync(request.Email, request.Name, request.Password, ct);
        if (result is null)
            return ctx.ErrorResult(422, "REGISTRATION_FAILED", "Unable to create account. Please try again or contact support.");

        var accessToken = jwtService.GenerateToken(result.User);
        var (rawRefresh, refreshHash) = jwtService.GenerateRefreshToken();

        var refreshTokenId = Guid.NewGuid();
        await refreshTokenRepo.CreateAsync(new RefreshToken
        {
            Id = refreshTokenId,
            UserId = result.User.Id,
            TokenHash = refreshHash,
            ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await LoginSessionHelper.RecordAsync(ctx, sessionRepo, result.User.Id, refreshTokenId, ct);

        // Send verification email (fire-and-forget) — skip for first user (auto-verified super admin)
        if (result.RawVerificationToken is not null)
        {
            var verifyUrl = $"{appSettings.Value.FrontendUrl}/verify-email?token={result.RawVerificationToken}";
            _ = emailService.SendVerificationEmailAsync(result.User.Email, result.User.Name, verifyUrl, CancellationToken.None)
                .ContinueWith(t => ctx.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("AuthEndpoints")
                    .LogWarning(t.Exception, "Failed to send verification email to {Email}", result.User.Email),
                    TaskContinuationOptions.OnlyOnFaulted);
        }

        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, result.User.Id, ct);
        return Results.Created("/api/auth/me", new AuthResponse(accessToken, rawRefresh, ToDto(result.User), workspaces));
    }

    private static async Task<IResult> HandleRefresh(
        HttpContext ctx,
        RefreshTokenRequest request,
        IAccountService accountService,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Refresh token is required.");

        var result = await accountService.RefreshTokensAsync(request.RefreshToken, ct);
        if (result is null)
            return ctx.ErrorResult(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");

        await LoginSessionHelper.RecordAsync(ctx, sessionRepo, result.User.Id, result.NewRefreshTokenId, ct);

        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, result.User.Id, ct);
        return Results.Ok(new AuthResponse(result.AccessToken, result.RawRefreshToken, ToDto(result.User), workspaces));
    }

    private static async Task<IResult> HandleVerifyEmail(
        HttpContext ctx,
        VerifyEmailRequest request,
        IAuthService authService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Token is required.");

        var (success, errorCode, message) = await authService.VerifyEmailAsync(request.Token, ct);
        if (!success)
            return ctx.ErrorResult(400, errorCode!, message!);

        return Results.Ok(new { message });
    }

    private static async Task<IResult> HandleResendVerification(
        HttpContext ctx,
        IAuthService authService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var (success, errorCode, message) = await authService.ResendVerificationAsync(tenantId, userId, ct);
        if (!success)
        {
            var statusCode = errorCode switch
            {
                "NOT_FOUND" => 404,
                "ALREADY_VERIFIED" => 409,
                "RATE_LIMIT" => 429,
                _ => 400
            };
            return ctx.ErrorResult(statusCode, errorCode!, message!);
        }

        return Results.Ok(new { message });
    }

    private static async Task<IResult> HandleForgotPassword(
        ForgotPasswordRequest request,
        IAuthService authService,
        CancellationToken ct)
    {
        await authService.ForgotPasswordAsync(request.Email, ct);

        // Always return 200 to prevent email enumeration
        return Results.Ok(new { message = "If an account exists, a reset email has been sent." });
    }

    private static async Task<IResult> HandleResetPassword(
        HttpContext ctx,
        ResetPasswordRequest request,
        IAuthService authService,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Token is required.");

        var (success, errorCode, message) = await authService.ResetPasswordAsync(request.Token, request.NewPassword, ct);
        if (!success)
        {
            var statusCode = errorCode switch
            {
                "VALIDATION_ERROR" => 422,
                _ => 400
            };
            return ctx.ErrorResult(statusCode, errorCode!, message!);
        }

        return Results.Ok(new { message });
    }

    private static async Task<IResult> HandleGoogleAuth(
        HttpContext ctx,
        GoogleAuthRequest request,
        IGoogleAuthService googleAuthService,
        IAccountService accountService,
        IRefreshTokenRepository refreshTokenRepo,
        ILoginSessionRepository sessionRepo,
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        IUserRepository userRepo,
        IConfiguration configuration,
        JwtService jwtService,
        CancellationToken ct)
    {
        if (!googleAuthService.IsConfigured)
            return ctx.ErrorResult(503, "GOOGLE_AUTH_NOT_CONFIGURED", "Google authentication is not configured.");

        if (string.IsNullOrWhiteSpace(request.IdToken))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "ID token is required.");

        // Pre-check: if registration is disabled, verify the Google user already has an account
        if (!IsRegistrationAllowed(configuration))
        {
            try
            {
                var googleUser = await googleAuthService.ValidateIdTokenAsync(request.IdToken, ct);
                var existsByGoogle = await userRepo.GetByGoogleIdAsync(googleUser.GoogleId, ct);
                var existsByEmail = existsByGoogle ?? await userRepo.GetByEmailAsync(googleUser.Email, ct);
                if (existsByEmail is null)
                    return ctx.ErrorResult(403, "REGISTRATION_DISABLED", "New account registration is currently disabled.");
            }
            catch (Exception)
            {
                return ctx.ErrorResult(401, "INVALID_GOOGLE_TOKEN", "Google ID token is invalid or expired.");
            }
        }

        GoogleAuthResult result;
        try
        {
            result = await accountService.AuthenticateWithGoogleAsync(request.IdToken, ct);
        }
        catch (Exception)
        {
            return ctx.ErrorResult(401, "INVALID_GOOGLE_TOKEN", "Google ID token is invalid or expired.");
        }

        // Generate tokens
        var accessToken = jwtService.GenerateToken(result.User);
        var (rawRefresh, refreshHash) = jwtService.GenerateRefreshToken();

        var refreshTokenId = Guid.NewGuid();
        await refreshTokenRepo.CreateAsync(new RefreshToken
        {
            Id = refreshTokenId,
            UserId = result.User.Id,
            TokenHash = refreshHash,
            ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
            CreatedAt = DateTime.UtcNow
        }, ct);

        await LoginSessionHelper.RecordAsync(ctx, sessionRepo, result.User.Id, refreshTokenId, ct);

        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, result.User.Id, ct);
        return Results.Ok(new { token = accessToken, refreshToken = rawRefresh, user = ToDto(result.User), isNewUser = result.IsNewUser, workspaces });
    }

    private static async Task<IResult> HandleSetupStatus(
        IUserRepository userRepo,
        IConfiguration configuration,
        CancellationToken ct)
    {
        var isSetupComplete = await userRepo.AnyUsersExistAsync(ct);
        var allowRegistration = !isSetupComplete || IsRegistrationAllowed(configuration);
        var emailProvider = configuration["Email:Provider"] ?? "none";
        var emailEnabled = !string.Equals(emailProvider, "none", StringComparison.OrdinalIgnoreCase);
        return Results.Ok(new { isSetupComplete, allowRegistration, emailEnabled });
    }

    private static bool IsRegistrationAllowed(IConfiguration configuration)
    {
        var value = configuration["App:AllowRegistration"];
        // Default to true if not explicitly set to "false"
        return !string.Equals(value, "false", StringComparison.OrdinalIgnoreCase);
    }

    internal static async Task<List<WorkspaceDto>> BuildWorkspaceListAsync(
        ITenantMembershipRepository membershipRepo,
        ITenantRepository tenantRepo,
        Guid userId,
        CancellationToken ct)
    {
        var memberships = await membershipRepo.GetByUserIdAsync(userId, ct);
        if (memberships.Count == 0) return [];

        var tenantIds = memberships.Select(m => m.TenantId).ToList();
        var tenants = await tenantRepo.GetByIdsAsync(tenantIds, ct);
        var memberCounts = await membershipRepo.CountMembersByTenantIdsAsync(tenantIds, ct);

        var workspaces = new List<WorkspaceDto>();
        foreach (var m in memberships)
        {
            if (!tenants.TryGetValue(m.TenantId, out var tenant)) continue;

            workspaces.Add(new WorkspaceDto(
                m.TenantId,
                tenant.Name,
                m.Role.ToString().ToLower(),
                m.IsPersonal,
                memberCounts.GetValueOrDefault(m.TenantId, 0),
                TenantEndpoints.TenantAvatarUrl(tenant)));
        }

        return workspaces;
    }

    internal static UserDto ToDto(User user) =>
        new(user.Id, user.Email, user.Name, user.Role.ToString().ToLower(), user.EmailVerified, user.OnboardingCompleted,
            AvatarHelpers.UserAvatarUrl(user), user.PasswordHash is not null, user.IsSuperUser, user.ThemePreference);

}
