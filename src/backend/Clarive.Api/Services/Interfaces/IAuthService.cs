namespace Clarive.Api.Services.Interfaces;

public interface IAuthService
{
    Task<(bool Success, string? ErrorCode, string? Message)> VerifyEmailAsync(
        string token, CancellationToken ct = default);

    Task<(bool Success, string? ErrorCode, string? Message)> ResendVerificationAsync(
        Guid tenantId, Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Creates a password reset token and sends the email.
    /// Always completes without error to prevent email enumeration.
    /// </summary>
    Task ForgotPasswordAsync(string? email, CancellationToken ct = default);

    Task<(bool Success, string? ErrorCode, string? Message)> ResetPasswordAsync(
        string token, string newPassword, CancellationToken ct = default);
}
