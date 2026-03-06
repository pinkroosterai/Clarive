using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface ITokenRepository
{
    // Email verification
    Task<EmailVerificationToken> CreateVerificationTokenAsync(
        EmailVerificationToken token, CancellationToken ct = default);
    Task<EmailVerificationToken?> GetVerificationByHashAsync(
        string tokenHash, CancellationToken ct = default);
    Task MarkVerificationUsedAsync(Guid tokenId, CancellationToken ct = default);
    Task<int> CountRecentVerificationTokensAsync(
        Guid userId, TimeSpan window, CancellationToken ct = default);

    // Password reset
    Task<PasswordResetToken> CreateResetTokenAsync(
        PasswordResetToken token, CancellationToken ct = default);
    Task<PasswordResetToken?> GetResetByHashAsync(
        string tokenHash, CancellationToken ct = default);
    Task MarkResetUsedAsync(Guid tokenId, CancellationToken ct = default);
    Task<int> CountRecentResetTokensAsync(
        Guid userId, TimeSpan window, CancellationToken ct = default);
}
