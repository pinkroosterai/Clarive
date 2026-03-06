using Clarive.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Services.Background;

public class TokenCleanupBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<TokenCleanupBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Initial delay to let the app fully start
        await Task.Delay(TimeSpan.FromMinutes(2), ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredTokensAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error during token cleanup cycle");
            }

            await Task.Delay(TimeSpan.FromHours(6), ct);
        }
    }

    private async Task CleanupExpiredTokensAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();

        var cutoff = DateTime.UtcNow;

        var refreshDeleted = await db.RefreshTokens
            .Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        var verificationDeleted = await db.EmailVerificationTokens
            .Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        var resetDeleted = await db.PasswordResetTokens
            .Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        // Also clean up revoked refresh tokens older than 7 days
        var revokedCutoff = cutoff.AddDays(-7);
        var revokedDeleted = await db.RefreshTokens
            .Where(t => t.RevokedAt != null && t.RevokedAt < revokedCutoff)
            .ExecuteDeleteAsync(ct);

        var total = refreshDeleted + verificationDeleted + resetDeleted + revokedDeleted;
        if (total > 0)
        {
            logger.LogInformation(
                "Token cleanup: {RefreshCount} expired refresh, {VerifyCount} verification, {ResetCount} reset, {RevokedCount} revoked tokens deleted",
                refreshDeleted, verificationDeleted, resetDeleted, revokedDeleted);
        }
    }
}
