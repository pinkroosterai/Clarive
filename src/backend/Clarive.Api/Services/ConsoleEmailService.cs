using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class ConsoleEmailService(ILogger<ConsoleEmailService> logger) : IEmailService
{
    public Task SendVerificationEmailAsync(string toEmail, string userName, string verifyUrl, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL] Verification → {Email} ({Name})\n  URL: {Url}",
            toEmail, userName, verifyUrl);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetUrl, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL] Password Reset → {Email} ({Name})\n  URL: {Url}",
            toEmail, userName, resetUrl);
        return Task.CompletedTask;
    }

    public Task SendAccountDeletionScheduledAsync(string toEmail, string userName, DateTime purgeDate, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL] Account Deletion Scheduled → {Email} ({Name})\n  Purge date: {PurgeDate:O}",
            toEmail, userName, purgeDate);
        return Task.CompletedTask;
    }

    public Task SendAccountDeletionCompletedAsync(string toEmail, string userName, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL] Account Deletion Completed → {Email} ({Name})",
            toEmail, userName);
        return Task.CompletedTask;
    }

    public Task SendInvitationEmailAsync(string toEmail, string inviterName, string workspaceName, string role, string acceptUrl, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL] Invitation → {Email}\n  From: {Inviter} ({Workspace})\n  Role: {Role}\n  URL: {Url}",
            toEmail, inviterName, workspaceName, role, acceptUrl);
        return Task.CompletedTask;
    }

    public Task SendWorkspaceInviteEmailAsync(string toEmail, string recipientName, string workspaceName, string role, string inviterName, string loginUrl, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL] Workspace Invite → {Email} ({Name})\n  Workspace: {Workspace}\n  Role: {Role}\n  From: {Inviter}\n  Login: {Url}",
            toEmail, recipientName, workspaceName, role, inviterName, loginUrl);
        return Task.CompletedTask;
    }
}
