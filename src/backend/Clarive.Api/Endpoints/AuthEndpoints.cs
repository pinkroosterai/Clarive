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

        group.MapGet("/me", HandleGetMe)
            .RequireAuthorization();

        group.MapPatch("/profile", HandleUpdateProfile)
            .RequireAuthorization();

        group.MapPost("/complete-onboarding", HandleCompleteOnboarding)
            .RequireAuthorization();

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
        IUserRepository userRepo,
        ITokenRepository tokenRepo,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Token is required.");

        var tokenHash = JwtService.HashRefreshToken(request.Token);
        var verification = await tokenRepo.GetVerificationByHashAsync(tokenHash, ct);

        if (verification is null || verification.UsedAt is not null || verification.ExpiresAt < DateTime.UtcNow)
            return ctx.ErrorResult(400, "INVALID_TOKEN", "Verification token is invalid or expired.");

        var user = await userRepo.GetByIdCrossTenantsAsync(verification.UserId, ct);
        if (user is null)
            return ctx.ErrorResult(400, "INVALID_TOKEN", "Verification token is invalid or expired.");

        if (user.EmailVerified)
        {
            // Already verified — mark token used and return success
            await tokenRepo.MarkVerificationUsedAsync(verification.Id, ct);
            return Results.Ok(new { message = "Email already verified." });
        }

        user.EmailVerified = true;
        await userRepo.UpdateAsync(user, ct);
        await tokenRepo.MarkVerificationUsedAsync(verification.Id, ct);

        return Results.Ok(new { message = "Email verified successfully." });
    }

    private static async Task<IResult> HandleResendVerification(
        HttpContext ctx,
        IUserRepository userRepo,
        ITokenRepository tokenRepo,
        IEmailService emailService,
        IOptions<AppSettings> appSettings,
        JwtService jwtService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        if (user.EmailVerified)
            return ctx.ErrorResult(409, "ALREADY_VERIFIED", "Email is already verified.");

        // Rate limit: max 1 token per 2 minutes
        var recentCount = await tokenRepo.CountRecentVerificationTokensAsync(userId, TimeSpan.FromMinutes(2), ct);
        if (recentCount >= 1)
            return ctx.ErrorResult(429, "RATE_LIMIT", "Please wait before requesting another verification email.");

        var (rawToken, _) = jwtService.GenerateRefreshToken();
        await tokenRepo.CreateVerificationTokenAsync(new EmailVerificationToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = JwtService.HashRefreshToken(rawToken),
            ExpiresAt = DateTime.UtcNow.AddHours(24),
            CreatedAt = DateTime.UtcNow
        }, ct);

        var verifyUrl = $"{appSettings.Value.FrontendUrl}/verify-email?token={rawToken}";
        await emailService.SendVerificationEmailAsync(user.Email, user.Name, verifyUrl, ct);

        return Results.Ok(new { message = "Verification email sent." });
    }

    private static async Task<IResult> HandleForgotPassword(
        HttpContext ctx,
        ForgotPasswordRequest request,
        IUserRepository userRepo,
        ITokenRepository tokenRepo,
        IEmailService emailService,
        IOptions<AppSettings> appSettings,
        JwtService jwtService,
        CancellationToken ct)
    {
        // Always return 200 to prevent email enumeration
        if (string.IsNullOrWhiteSpace(request.Email))
            return Results.Ok(new { message = "If an account exists, a reset email has been sent." });

        var user = await userRepo.GetByEmailAsync(request.Email, ct);
        if (user is null)
            return Results.Ok(new { message = "If an account exists, a reset email has been sent." });

        // Rate limit: max 3 tokens per user per hour
        var recentCount = await tokenRepo.CountRecentResetTokensAsync(user.Id, TimeSpan.FromHours(1), ct);
        if (recentCount >= 3)
            return Results.Ok(new { message = "If an account exists, a reset email has been sent." });

        var (rawToken, _) = jwtService.GenerateRefreshToken();
        await tokenRepo.CreateResetTokenAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = JwtService.HashRefreshToken(rawToken),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow
        }, ct);

        var resetUrl = $"{appSettings.Value.FrontendUrl}/reset-password?token={rawToken}";
        await emailService.SendPasswordResetEmailAsync(user.Email, user.Name, resetUrl, ct);

        return Results.Ok(new { message = "If an account exists, a reset email has been sent." });
    }

    private static async Task<IResult> HandleResetPassword(
        HttpContext ctx,
        ResetPasswordRequest request,
        IUserRepository userRepo,
        ITokenRepository tokenRepo,
        IRefreshTokenRepository refreshTokenRepo,
        PasswordHasher passwordHasher,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Token is required.");
        if (Validator.RequirePassword(request.NewPassword) is { } pwErr) return pwErr;

        var tokenHash = JwtService.HashRefreshToken(request.Token);
        var reset = await tokenRepo.GetResetByHashAsync(tokenHash, ct);

        if (reset is null || reset.UsedAt is not null || reset.ExpiresAt < DateTime.UtcNow)
            return ctx.ErrorResult(400, "INVALID_TOKEN", "Reset token is invalid or expired.");

        var user = await userRepo.GetByIdCrossTenantsAsync(reset.UserId, ct);
        if (user is null)
            return ctx.ErrorResult(400, "INVALID_TOKEN", "Reset token is invalid or expired.");

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        await userRepo.UpdateAsync(user, ct);
        await tokenRepo.MarkResetUsedAsync(reset.Id, ct);

        // Revoke all refresh tokens for security
        await refreshTokenRepo.RevokeAllForUserAsync(user.Id, ct);

        return Results.Ok(new { message = "Password reset successfully." });
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
        return Results.Ok(new { isSetupComplete, allowRegistration });
    }

    private static bool IsRegistrationAllowed(IConfiguration configuration)
    {
        var value = configuration["App:AllowRegistration"];
        // Default to true if not explicitly set to "false"
        return !string.Equals(value, "false", StringComparison.OrdinalIgnoreCase);
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

        var workspaces = await BuildWorkspaceListAsync(membershipRepo, tenantRepo, userId, ct);
        var dto = ToDto(user);
        return Results.Ok(new
        {
            dto.Id, dto.Email, dto.Name, dto.Role, dto.EmailVerified, dto.OnboardingCompleted, dto.AvatarUrl,
            dto.HasPassword, dto.IsSuperUser, dto.ThemePreference, Workspaces = workspaces
        });
    }

    private static async Task<IResult> HandleUpdateProfile(
        HttpContext ctx,
        UpdateProfileRequest request,
        IUserRepository userRepo,
        PasswordHasher passwordHasher,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        if (ValidateCurrentPassword(ctx, request, user, passwordHasher) is { } pwError)
            return pwError;

        if (ApplyNameUpdate(ctx, request, user) is { } nameError)
            return nameError;

        if (await ApplyEmailUpdateAsync(ctx, request, user, userRepo, ct) is { } emailError)
            return emailError;

        if (ApplyPasswordUpdate(request, user, passwordHasher) is { } newPwError)
            return newPwError;

        if (ApplyThemePreferenceUpdate(ctx, request, user) is { } themeError)
            return themeError;

        await userRepo.UpdateAsync(user, ct);
        return Results.Ok(ToDto(user));
    }

    private static IResult? ValidateCurrentPassword(
        HttpContext ctx, UpdateProfileRequest request, User user, PasswordHasher passwordHasher)
    {
        if (request.NewPassword is not null && user.PasswordHash is null)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Password changes are not available for accounts using external sign-in.");

        if ((request.Email is not null || request.NewPassword is not null)
            && string.IsNullOrWhiteSpace(request.CurrentPassword))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Current password is required to change email or password.");

        if (request.CurrentPassword is not null
            && (user.PasswordHash is null || !passwordHasher.Verify(request.CurrentPassword, user.PasswordHash)))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Current password is incorrect.");

        return null;
    }

    private static IResult? ApplyNameUpdate(HttpContext ctx, UpdateProfileRequest request, User user)
    {
        if (request.Name is null) return null;

        if (request.Name.Length > 255)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name must be 255 characters or fewer.");

        user.Name = request.Name;
        return null;
    }

    private static async Task<IResult?> ApplyEmailUpdateAsync(
        HttpContext ctx, UpdateProfileRequest request, User user, IUserRepository userRepo, CancellationToken ct)
    {
        if (request.Email is null) return null;

        if (!Validator.IsValidEmail(request.Email))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Invalid email format.");

        var existing = await userRepo.GetByEmailAsync(request.Email, ct);
        if (existing is not null && existing.Id != user.Id)
            return ctx.ErrorResult(409, "EMAIL_EXISTS", "An account with this email already exists.");

        user.Email = request.Email.Trim().ToLowerInvariant();
        return null;
    }

    private static IResult? ApplyPasswordUpdate(
        UpdateProfileRequest request, User user, PasswordHasher passwordHasher)
    {
        if (request.NewPassword is null) return null;

        if (Validator.RequirePassword(request.NewPassword) is { } newPwErr)
            return newPwErr;

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        return null;
    }

    private static readonly HashSet<string> ValidThemePreferences = ["light", "dark", "system"];

    private static IResult? ApplyThemePreferenceUpdate(HttpContext ctx, UpdateProfileRequest request, User user)
    {
        if (request.ThemePreference is null) return null;

        if (!ValidThemePreferences.Contains(request.ThemePreference))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Theme preference must be 'light', 'dark', or 'system'.");

        user.ThemePreference = request.ThemePreference;
        return null;
    }

    private static async Task<IResult> HandleCompleteOnboarding(
        HttpContext ctx,
        IUserRepository userRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.");

        user.OnboardingCompleted = true;
        await userRepo.UpdateAsync(user, ct);

        return Results.NoContent();
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
