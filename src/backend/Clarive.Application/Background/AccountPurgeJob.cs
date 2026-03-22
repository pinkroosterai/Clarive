using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Quartz;

namespace Clarive.Application.Background;

[DisallowConcurrentExecution]
public class AccountPurgeJob(
    IAccountPurgeRepository repo,
    IEmailService emailService,
    ILogger<AccountPurgeJob> logger
) : IJob
{
    private const int BatchSize = 50;

    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        var totalTenants = 0;
        var totalUsers = 0;

        // Purge tenants scheduled for deletion — in batches for bounded memory and partial-failure resilience
        while (true)
        {
            var tenants = await repo.GetExpiredTenantsAsync(BatchSize, ct);

            if (tenants.Count == 0)
                break;

            foreach (var tenant in tenants)
            {
                logger.LogInformation(
                    "Purging tenant {TenantId} ({TenantName})",
                    tenant.Id,
                    tenant.Name
                );

                // Notify admin(s) before permanent deletion
                foreach (var user in tenant.Users)
                {
                    _ = emailService
                        .SendAccountDeletionCompletedAsync(
                            user.Email,
                            user.Name,
                            CancellationToken.None
                        )
                        .ContinueWith(
                            t =>
                                logger.LogWarning(
                                    t.Exception,
                                    "Failed to send deletion-completed email to {Email}",
                                    user.Email
                                ),
                            TaskContinuationOptions.OnlyOnFaulted
                        );
                }

                logger.LogInformation("Tenant {TenantId} permanently deleted", tenant.Id);
            }

            await repo.RemoveTenantsAsync(tenants, ct);
            totalTenants += tenants.Count;
        }

        // Purge individual users (non-admin) scheduled for deletion — in batches
        while (true)
        {
            var users = await repo.GetExpiredUsersAsync(BatchSize, ct);

            if (users.Count == 0)
                break;

            foreach (var user in users)
            {
                logger.LogInformation("Purging user {UserId} ({UserEmail})", user.Id, user.Email);
            }

            await repo.RemoveUsersAsync(users, ct);
            totalUsers += users.Count;
        }

        if (totalTenants > 0 || totalUsers > 0)
        {
            logger.LogInformation(
                "Account purge complete: {TenantCount} tenants, {UserCount} users deleted",
                totalTenants,
                totalUsers
            );
        }
    }
}
