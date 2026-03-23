using Microsoft.Extensions.Logging;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Infrastructure.Email;

public class ConsoleEmailService(ILogger<ConsoleEmailService> logger) : IEmailService
{
    public Task SendVerificationEmailAsync(
        string toEmail,
        string userName,
        string verifyUrl,
        CancellationToken ct = default
    )
    {
        logger.LogInformation(
            "[EMAIL] Verification → {Email} ({Name})\n  URL: {Url}",
            toEmail,
            userName,
            verifyUrl
        );
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(
        string toEmail,
        string userName,
        string resetUrl,
        CancellationToken ct = default
    )
    {
        logger.LogInformation(
            "[EMAIL] Password Reset → {Email} ({Name})\n  URL: {Url}",
            toEmail,
            userName,
            resetUrl
        );
        return Task.CompletedTask;
    }

    public Task SendAccountDeletionScheduledAsync(
        string toEmail,
        string userName,
        DateTime purgeDate,
        CancellationToken ct = default
    )
    {
        logger.LogInformation(
            "[EMAIL] Account Deletion Scheduled → {Email} ({Name})\n  Purge date: {PurgeDate:O}",
            toEmail,
            userName,
            purgeDate
        );
        return Task.CompletedTask;
    }

    public Task SendAccountDeletionCompletedAsync(
        string toEmail,
        string userName,
        CancellationToken ct = default
    )
    {
        logger.LogInformation(
            "[EMAIL] Account Deletion Completed → {Email} ({Name})",
            toEmail,
            userName
        );
        return Task.CompletedTask;
    }

    public Task SendInvitationEmailAsync(
        string toEmail,
        string inviterName,
        string workspaceName,
        string role,
        string acceptUrl,
        CancellationToken ct = default
    )
    {
        logger.LogInformation(
            "[EMAIL] Invitation → {Email}\n  From: {Inviter} ({Workspace})\n  Role: {Role}\n  URL: {Url}",
            toEmail,
            inviterName,
            workspaceName,
            role,
            acceptUrl
        );
        return Task.CompletedTask;
    }

    public Task SendWorkspaceInviteEmailAsync(
        string toEmail,
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl,
        CancellationToken ct = default
    )
    {
        logger.LogInformation(
            "[EMAIL] Workspace Invite → {Email} ({Name})\n  Workspace: {Workspace}\n  Role: {Role}\n  From: {Inviter}\n  Login: {Url}",
            toEmail,
            recipientName,
            workspaceName,
            role,
            inviterName,
            loginUrl
        );
        return Task.CompletedTask;
    }

    public Task SendTestEmailAsync(string toEmail, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] Test Email → {Email}", toEmail);
        return Task.CompletedTask;
    }

    public Task SendPasswordChangedAsync(string toEmail, string userName, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] Password Changed → {Email} ({Name})", toEmail, userName);
        return Task.CompletedTask;
    }

    public Task SendEmailChangedAsync(string toEmail, string userName, string newEmail, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] Email Changed → {Email} ({Name})\n  New: {NewEmail}", toEmail, userName, newEmail);
        return Task.CompletedTask;
    }

    public Task SendApiKeyCreatedAsync(string toEmail, string userName, string keyName, string keyPrefix, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] API Key Created → {Email} ({Name})\n  Key: {KeyName} ({Prefix})", toEmail, userName, keyName, keyPrefix);
        return Task.CompletedTask;
    }

    public Task SendApiKeyRevokedAsync(string toEmail, string userName, string keyName, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] API Key Revoked → {Email} ({Name})\n  Key: {KeyName}", toEmail, userName, keyName);
        return Task.CompletedTask;
    }

    public Task SendRoleChangedAsync(string toEmail, string userName, string workspaceName, string oldRole, string newRole, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] Role Changed → {Email} ({Name})\n  Workspace: {Workspace}\n  {OldRole} → {NewRole}", toEmail, userName, workspaceName, oldRole, newRole);
        return Task.CompletedTask;
    }

    public Task SendRemovedFromWorkspaceAsync(string toEmail, string userName, string workspaceName, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] Removed from Workspace → {Email} ({Name})\n  Workspace: {Workspace}", toEmail, userName, workspaceName);
        return Task.CompletedTask;
    }

    public Task SendOwnershipTransferredAsync(string toEmail, string userName, string workspaceName, string fromName, string toName, CancellationToken ct = default)
    {
        logger.LogInformation("[EMAIL] Ownership Transferred → {Email} ({Name})\n  Workspace: {Workspace}\n  From: {From} → To: {To}", toEmail, userName, workspaceName, fromName, toName);
        return Task.CompletedTask;
    }
}
