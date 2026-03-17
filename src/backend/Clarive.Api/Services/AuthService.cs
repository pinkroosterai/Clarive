using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class AuthService(
    IUserRepository userRepo,
    ITokenRepository tokenRepo,
    IRefreshTokenRepository refreshTokenRepo,
    IEmailService emailService,
    IOptions<AppSettings> appSettings,
    JwtService jwtService,
    PasswordHasher passwordHasher) : IAuthService
{
    public async Task<ErrorOr<string>> VerifyEmailAsync(
        string token, CancellationToken ct)
    {
        var tokenHash = JwtService.HashRefreshToken(token);
        var verification = await tokenRepo.GetVerificationByHashAsync(tokenHash, ct);

        if (verification is null || verification.UsedAt is not null || verification.ExpiresAt < DateTime.UtcNow)
            return Error.Validation("INVALID_TOKEN", "Verification token is invalid or expired.");

        var user = await userRepo.GetByIdCrossTenantsAsync(verification.UserId, ct);
        if (user is null)
            return Error.Validation("INVALID_TOKEN", "Verification token is invalid or expired.");

        if (user.EmailVerified)
        {
            await tokenRepo.MarkVerificationUsedAsync(verification.Id, ct);
            return "Email already verified.";
        }

        user.EmailVerified = true;
        await userRepo.UpdateAsync(user, ct);
        await tokenRepo.MarkVerificationUsedAsync(verification.Id, ct);

        return "Email verified successfully.";
    }

    public async Task<ErrorOr<string>> ResendVerificationAsync(
        Guid tenantId, Guid userId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);

        if (user is null)
            return DomainErrors.UserNotFound;

        if (user.EmailVerified)
            return Error.Conflict("ALREADY_VERIFIED", "Email is already verified.");

        // Rate limit: max 1 token per 2 minutes
        var recentCount = await tokenRepo.CountRecentVerificationTokensAsync(userId, TimeSpan.FromMinutes(2), ct);
        if (recentCount >= 1)
            return Error.Custom(429, "RATE_LIMIT", "Please wait before requesting another verification email.");

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

        return "Verification email sent.";
    }

    public async Task ForgotPasswordAsync(string? email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email))
            return;

        var user = await userRepo.GetByEmailAsync(email, ct);
        if (user is null)
            return;

        // Rate limit: max 3 tokens per user per hour
        var recentCount = await tokenRepo.CountRecentResetTokensAsync(user.Id, TimeSpan.FromHours(1), ct);
        if (recentCount >= 3)
            return;

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
    }

    public async Task<ErrorOr<string>> ResetPasswordAsync(
        string token, string newPassword, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(newPassword))
            return Error.Validation("VALIDATION_ERROR", "Password is required.");

        if (newPassword.Length < Validator.MinPasswordLength)
            return Error.Validation("VALIDATION_ERROR", $"Password must be at least {Validator.MinPasswordLength} characters.");

        var tokenHash = JwtService.HashRefreshToken(token);
        var reset = await tokenRepo.GetResetByHashAsync(tokenHash, ct);

        if (reset is null || reset.UsedAt is not null || reset.ExpiresAt < DateTime.UtcNow)
            return Error.Validation("INVALID_TOKEN", "Reset token is invalid or expired.");

        var user = await userRepo.GetByIdCrossTenantsAsync(reset.UserId, ct);
        if (user is null)
            return Error.Validation("INVALID_TOKEN", "Reset token is invalid or expired.");

        user.PasswordHash = passwordHasher.Hash(newPassword);
        await userRepo.UpdateAsync(user, ct);
        await tokenRepo.MarkResetUsedAsync(reset.Id, ct);

        // Revoke all refresh tokens for security
        await refreshTokenRepo.RevokeAllForUserAsync(user.Id, ct);

        return "Password reset successfully.";
    }
}
