using Clarive.Api.Data;
using Clarive.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Clarive.Api.Services.Background;

public class AccountPurgeBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<AccountPurgeBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Initial delay to let the app fully start
        await Task.Delay(TimeSpan.FromMinutes(1), ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await PurgeExpiredAccountsAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error during account purge cycle");
            }

            await Task.Delay(TimeSpan.FromHours(24), ct);
        }
    }

    private const int BatchSize = 50;

    private async Task PurgeExpiredAccountsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

        var now = DateTime.UtcNow;
        var totalTenants = 0;
        var totalUsers = 0;

        // Purge tenants scheduled for deletion — in batches for bounded memory and partial-failure resilience
        while (true)
        {
            var tenants = await db.Tenants
                .Include(t => t.Users)
                .Where(t => t.DeleteScheduledAt != null && t.DeleteScheduledAt <= now)
                .Take(BatchSize)
                .ToListAsync(ct);

            if (tenants.Count == 0) break;

            foreach (var tenant in tenants)
            {
                logger.LogInformation("Purging tenant {TenantId} ({TenantName})", tenant.Id, tenant.Name);

                // Notify admin(s) before permanent deletion
                foreach (var user in tenant.Users)
                {
                    _ = emailService.SendAccountDeletionCompletedAsync(
                        user.Email, user.Name, CancellationToken.None)
                        .ContinueWith(t => logger.LogWarning(t.Exception,
                            "Failed to send deletion-completed email to {Email}", user.Email),
                            TaskContinuationOptions.OnlyOnFaulted);
                }

                // Cascade delete handles all child entities
                db.Tenants.Remove(tenant);
                logger.LogInformation("Tenant {TenantId} permanently deleted", tenant.Id);
            }

            await db.SaveChangesAsync(ct);
            totalTenants += tenants.Count;
        }

        // Purge individual users (non-admin) scheduled for deletion — in batches
        while (true)
        {
            var users = await db.Users
                .Where(u => u.DeleteScheduledAt != null && u.DeleteScheduledAt <= now)
                .Take(BatchSize)
                .ToListAsync(ct);

            if (users.Count == 0) break;

            foreach (var user in users)
            {
                logger.LogInformation("Purging user {UserId} ({UserEmail})", user.Id, user.Email);
                db.Users.Remove(user);
            }

            await db.SaveChangesAsync(ct);
            totalUsers += users.Count;
        }

        if (totalTenants > 0 || totalUsers > 0)
        {
            logger.LogInformation("Account purge complete: {TenantCount} tenants, {UserCount} users deleted",
                totalTenants, totalUsers);
        }
    }
}
