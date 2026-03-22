using Clarive.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quartz;

namespace Clarive.Infrastructure.BackgroundJobs;

[DisallowConcurrentExecution]
public class TokenCleanupJob(
    ClariveDbContext db,
    ILogger<TokenCleanupJob> logger
) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;
        var cutoff = DateTime.UtcNow;

        var refreshDeleted = await db
            .RefreshTokens.Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        var verificationDeleted = await db
            .EmailVerificationTokens.Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        var resetDeleted = await db
            .PasswordResetTokens.Where(t => t.ExpiresAt < cutoff)
            .ExecuteDeleteAsync(ct);

        // Also clean up revoked refresh tokens older than 7 days
        var revokedCutoff = cutoff.AddDays(-7);
        var revokedDeleted = await db
            .RefreshTokens.Where(t => t.RevokedAt != null && t.RevokedAt < revokedCutoff)
            .ExecuteDeleteAsync(ct);

        var total = refreshDeleted + verificationDeleted + resetDeleted + revokedDeleted;
        if (total > 0)
        {
            logger.LogInformation(
                "Token cleanup: {RefreshCount} expired refresh, {VerifyCount} verification, {ResetCount} reset, {RevokedCount} revoked tokens deleted",
                refreshDeleted,
                verificationDeleted,
                resetDeleted,
                revokedDeleted
            );
        }
    }
}
