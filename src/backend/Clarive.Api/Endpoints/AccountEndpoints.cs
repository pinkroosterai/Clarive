using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Api.Services.Interfaces;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Api.Endpoints;

public static class AccountEndpoints
{
    private static readonly TimeSpan DeletionGracePeriod = TimeSpan.FromDays(30);

    public static RouteGroupBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/account").WithTags("Account").RequireAuthorization();

        group.MapPost("/delete", HandleDeleteAccount);
        group.MapPost("/cancel-deletion", HandleCancelDeletion);

        return group;
    }

    private static async Task<IResult> HandleDeleteAccount(
        HttpContext ctx,
        DeleteAccountRequest request,
        IUserRepository userRepo,
        ITenantRepository tenantRepo,
        IRefreshTokenRepository refreshTokenRepo,
        IEmailService emailService,
        ILoggerFactory loggerFactory,
        CancellationToken ct
    )
    {
        if (request.Confirmation != "DELETE")
            return ctx.ErrorResult(
                422,
                "VALIDATION_ERROR",
                "You must type DELETE to confirm account deletion."
            );

        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);
        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        if (user.DeleteScheduledAt is not null)
            return ctx.ErrorResult(
                409,
                "ALREADY_SCHEDULED",
                "Account deletion is already scheduled."
            );

        var now = DateTime.UtcNow;
        var deleteAt = now + DeletionGracePeriod;

        if (ctx.User.IsInRole("admin"))
        {
            // Check if sole member of the organization
            var tenantUsers = await userRepo.GetByTenantAsync(tenantId, ct);
            var activeUsers = tenantUsers.Where(u => u.DeleteScheduledAt is null).ToList();

            if (activeUsers.Count > 1)
                return ctx.ErrorResult(
                    409,
                    "TRANSFER_OWNERSHIP",
                    "You must remove all other users or transfer ownership before deleting the organization."
                );

            // Schedule tenant deletion (cascades to all entities)
            var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
            if (tenant is not null)
            {
                tenant.DeletedAt = now;
                tenant.DeleteScheduledAt = deleteAt;
                await tenantRepo.UpdateAsync(tenant, ct);
            }
        }

        // Schedule user deletion
        user.DeletedAt = now;
        user.DeleteScheduledAt = deleteAt;
        await userRepo.UpdateAsync(user, ct);

        // Revoke all refresh tokens
        await refreshTokenRepo.RevokeAllForUserAsync(userId, ct);

        // Send notification email
        var emailLogger = loggerFactory.CreateLogger("AccountEndpoints");
        _ = emailService
            .SendAccountDeletionScheduledAsync(
                user.Email,
                user.Name,
                deleteAt,
                CancellationToken.None
            )
            .ContinueWith(
                t =>
                    emailLogger.LogWarning(
                        t.Exception,
                        "Failed to send deletion-scheduled email to {Email}",
                        user.Email
                    ),
                TaskContinuationOptions.OnlyOnFaulted
            );

        return Results.Ok(
            new { message = "Account deletion scheduled.", deleteScheduledAt = deleteAt }
        );
    }

    private static async Task<IResult> HandleCancelDeletion(
        HttpContext ctx,
        IUserRepository userRepo,
        ITenantRepository tenantRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var user = await userRepo.GetByIdAsync(tenantId, userId, ct);
        if (user is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "User not found.", "User", userId.ToString());

        if (user.DeleteScheduledAt is null)
            return ctx.ErrorResult(409, "NOT_SCHEDULED", "No account deletion is scheduled.");

        // Clear user deletion
        user.DeletedAt = null;
        user.DeleteScheduledAt = null;
        await userRepo.UpdateAsync(user, ct);

        // If admin, also clear tenant deletion
        if (ctx.User.IsInRole("admin"))
        {
            var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
            if (tenant is not null && tenant.DeleteScheduledAt is not null)
            {
                tenant.DeletedAt = null;
                tenant.DeleteScheduledAt = null;
                await tenantRepo.UpdateAsync(tenant, ct);
            }
        }

        return Results.Ok(new { message = "Account deletion cancelled." });
    }
}
