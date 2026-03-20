using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Data;
using Clarive.Domain.Errors;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using ErrorOr;
using Microsoft.Extensions.Options;

namespace Clarive.Application.Invitations;

public class InvitationService(
    ClariveDbContext db,
    IInvitationRepository invitationRepo,
    IUserRepository userRepo,
    ITenantRepository tenantRepo,
    ITenantMembershipRepository membershipRepo,
    IAuditLogger auditLogger,
    IEmailService emailService,
    JwtService jwtService,
    IOptions<AppSettings> appSettings,
    ILogger<InvitationService> logger
) : IInvitationService
{
    public async Task<ErrorOr<CreateInvitationResult>> CreateAsync(
        Guid tenantId,
        Guid invitedById,
        string inviterName,
        string email,
        UserRole role,
        CancellationToken ct
    )
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var existingUser = await userRepo.GetByEmailAsync(normalizedEmail, ct);

        if (existingUser is not null)
            return await CreateForExistingUserAsync(
                tenantId,
                invitedById,
                inviterName,
                normalizedEmail,
                role,
                existingUser,
                ct
            );

        return await CreateForNewUserAsync(
            tenantId,
            invitedById,
            inviterName,
            normalizedEmail,
            role,
            ct
        );
    }

    public async Task<InvitationValidation?> ValidateAsync(string token, CancellationToken ct)
    {
        var tokenHash = JwtService.HashRefreshToken(token);
        var invitation = await invitationRepo.GetByTokenHashAsync(tokenHash, ct);

        if (invitation is null || invitation.ExpiresAt <= DateTime.UtcNow)
            return null;

        var tenant = await tenantRepo.GetByIdAsync(invitation.TenantId, ct);

        return new InvitationValidation(
            invitation.Email,
            invitation.Role.ToString().ToLower(),
            tenant?.Name ?? "Clarive"
        );
    }

    public async Task<ResendInvitationResult?> ResendAsync(
        Guid tenantId,
        Guid invitationId,
        string inviterName,
        CancellationToken ct
    )
    {
        var invitation = await invitationRepo.GetByIdAsync(tenantId, invitationId, ct);
        if (invitation is null)
            return null;

        invitation.ExpiresAt = DateTime.UtcNow.AddDays(7);

        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        var workspaceName = tenant?.Name ?? "Clarive";

        string? rawToken = null;
        string? targetUserName = null;

        if (invitation.TargetUserId is not null)
        {
            // Existing-user invite — resend login-link email
            await invitationRepo.UpdateAsync(invitation, ct);
            var targetUser = await userRepo.GetByIdCrossTenantsAsync(
                invitation.TargetUserId.Value,
                ct
            );
            targetUserName = targetUser?.Name ?? "there";
            var loginUrl = $"{appSettings.Value.FrontendUrl}/login";

            FireAndForgetEmail(() =>
                emailService.SendWorkspaceInviteEmailAsync(
                    invitation.Email,
                    targetUserName,
                    workspaceName,
                    invitation.Role.ToString().ToLower(),
                    inviterName,
                    loginUrl,
                    CancellationToken.None
                )
            );
        }
        else
        {
            // New-user invite — regenerate token and resend accept-link email
            (rawToken, var tokenHash) = jwtService.GenerateInvitationToken();
            invitation.TokenHash = tokenHash;
            await invitationRepo.UpdateAsync(invitation, ct);
            var acceptUrl = $"{appSettings.Value.FrontendUrl}/invite/accept?token={rawToken}";

            FireAndForgetEmail(() =>
                emailService.SendInvitationEmailAsync(
                    invitation.Email,
                    inviterName,
                    workspaceName,
                    invitation.Role.ToString().ToLower(),
                    acceptUrl,
                    CancellationToken.None
                )
            );
        }

        return new ResendInvitationResult(
            invitation,
            invitation.TargetUserId is not null,
            rawToken,
            targetUserName
        );
    }

    public async Task<Invitation?> RevokeAsync(
        Guid tenantId,
        Guid invitationId,
        CancellationToken ct
    )
    {
        var invitation = await invitationRepo.GetByIdAsync(tenantId, invitationId, ct);
        if (invitation is null)
            return null;

        await invitationRepo.DeleteAsync(tenantId, invitationId, ct);
        return invitation;
    }

    public async Task<ErrorOr<RespondInvitationResult>> RespondAsync(
        Guid userId,
        Guid invitationId,
        bool accept,
        CancellationToken ct
    )
    {
        var invitation = await invitationRepo.GetByIdCrossTenantsAsync(invitationId, ct);
        if (
            invitation is null
            || invitation.TargetUserId != userId
            || invitation.ExpiresAt <= DateTime.UtcNow
        )
            return DomainErrors.InvitationNotFound;

        if (!accept)
        {
            await invitationRepo.DeleteCrossTenantsAsync(invitationId, ct);
            return new RespondInvitationResult(false, null, null, null, null);
        }

        // Accept — check not already a member
        var existingMembership = await membershipRepo.GetAsync(userId, invitation.TenantId, ct);
        if (existingMembership is not null)
        {
            await invitationRepo.DeleteCrossTenantsAsync(invitationId, ct);
            return Error.Conflict("ALREADY_MEMBER", "You are already a member of this workspace.");
        }

        var membership = await db.Database.InTransactionAsync(
            async () =>
            {
                var m = await membershipRepo.CreateAsync(
                    new TenantMembership
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        TenantId = invitation.TenantId,
                        Role = invitation.Role,
                        IsPersonal = false,
                        JoinedAt = DateTime.UtcNow,
                    },
                    ct
                );

                await invitationRepo.DeleteCrossTenantsAsync(invitationId, ct);

                return m;
            },
            ct
        );

        var tenant = await tenantRepo.GetByIdAsync(invitation.TenantId, ct);
        var memberCount = (await membershipRepo.GetByTenantIdAsync(invitation.TenantId, ct)).Count;

        var avatarUrl = tenant?.AvatarPath != null ? $"/api/tenants/{tenant.Id}/avatar" : null;

        return new RespondInvitationResult(
            true,
            membership,
            tenant?.Name ?? "the workspace",
            memberCount,
            avatarUrl
        );
    }

    public async Task<List<PendingInvitationInfo>> GetPendingAsync(
        Guid userId,
        CancellationToken ct
    )
    {
        var invitations = await invitationRepo.GetPendingByUserIdAsync(userId, ct);
        var results = new List<PendingInvitationInfo>();

        foreach (var inv in invitations)
        {
            if (inv.ExpiresAt <= DateTime.UtcNow)
                continue;
            var tenant = await tenantRepo.GetByIdAsync(inv.TenantId, ct);
            var inviter = await userRepo.GetByIdCrossTenantsAsync(inv.InvitedById, ct);
            results.Add(
                new PendingInvitationInfo(
                    inv.Id,
                    tenant?.Name ?? "Unknown",
                    inv.Role.ToString().ToLower(),
                    inviter?.Name ?? "Unknown",
                    inv.CreatedAt,
                    inv.ExpiresAt
                )
            );
        }

        return results;
    }

    public async Task<int> GetPendingCountAsync(Guid userId, CancellationToken ct)
    {
        var invitations = await invitationRepo.GetPendingByUserIdAsync(userId, ct);
        return invitations.Count(i => i.ExpiresAt > DateTime.UtcNow);
    }

    private async Task<ErrorOr<CreateInvitationResult>> CreateForExistingUserAsync(
        Guid tenantId,
        Guid invitedById,
        string inviterName,
        string normalizedEmail,
        UserRole role,
        User existingUser,
        CancellationToken ct
    )
    {
        var existingMembership = await membershipRepo.GetAsync(existingUser.Id, tenantId, ct);
        if (existingMembership is not null)
            return Error.Conflict(
                "ALREADY_MEMBER",
                "This user is already a member of this workspace."
            );

        if (await invitationRepo.GetActiveByEmailAsync(tenantId, normalizedEmail, ct) is not null)
            return Error.Conflict(
                "INVITATION_EXISTS",
                "An active invitation for this email already exists."
            );

        var pendingInvite = await invitationRepo.CreateAsync(
            new Invitation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = normalizedEmail,
                Role = role,
                TokenHash = "",
                TargetUserId = existingUser.Id,
                InvitedById = invitedById,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        var workspaceName = tenant?.Name ?? "Clarive";
        var loginUrl = $"{appSettings.Value.FrontendUrl}/login";

        FireAndForgetEmail(() =>
            emailService.SendWorkspaceInviteEmailAsync(
                normalizedEmail,
                existingUser.Name,
                workspaceName,
                role.ToString().ToLower(),
                inviterName,
                loginUrl,
                CancellationToken.None
            )
        );

        await auditLogger.SafeLogAsync(
            tenantId,
            invitedById,
            inviterName,
            AuditAction.UserInvited,
            "invitation",
            pendingInvite.Id,
            normalizedEmail,
            $"Invited {normalizedEmail} as {role.ToString().ToLower()}",
            ct
        );

        return new CreateInvitationResult(pendingInvite, true, null);
    }

    private async Task<ErrorOr<CreateInvitationResult>> CreateForNewUserAsync(
        Guid tenantId,
        Guid invitedById,
        string inviterName,
        string normalizedEmail,
        UserRole role,
        CancellationToken ct
    )
    {
        if (await invitationRepo.GetActiveByEmailAsync(tenantId, normalizedEmail, ct) is not null)
            return Error.Conflict(
                "INVITATION_EXISTS",
                "An active invitation for this email already exists."
            );

        var (rawToken, tokenHash) = jwtService.GenerateInvitationToken();

        var invitation = await invitationRepo.CreateAsync(
            new Invitation
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Email = normalizedEmail,
                Role = role,
                TokenHash = tokenHash,
                InvitedById = invitedById,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        var tenant = await tenantRepo.GetByIdAsync(tenantId, ct);
        var workspaceName = tenant?.Name ?? "Clarive";
        var acceptUrl = $"{appSettings.Value.FrontendUrl}/invite/accept?token={rawToken}";

        FireAndForgetEmail(() =>
            emailService.SendInvitationEmailAsync(
                normalizedEmail,
                inviterName,
                workspaceName,
                role.ToString().ToLower(),
                acceptUrl,
                CancellationToken.None
            )
        );

        await auditLogger.SafeLogAsync(
            tenantId,
            invitedById,
            inviterName,
            AuditAction.UserInvited,
            "invitation",
            invitation.Id,
            normalizedEmail,
            $"Invited {normalizedEmail} as {role.ToString().ToLower()}",
            ct
        );

        return new CreateInvitationResult(invitation, false, rawToken);
    }

    private void FireAndForgetEmail(Func<Task> sendEmail)
    {
        _ = sendEmail()
            .ContinueWith(
                t => logger.LogWarning(t.Exception, "Failed to send invitation email"),
                TaskContinuationOptions.OnlyOnFaulted
            );
    }
}
