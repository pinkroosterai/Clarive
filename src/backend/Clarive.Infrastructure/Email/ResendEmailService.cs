using Microsoft.Extensions.Logging;
using Clarive.Domain.Interfaces.Services;
using Microsoft.Extensions.Options;
using Resend;

namespace Clarive.Infrastructure.Email;

public class ResendEmailService(
    IResend resend,
    IOptionsSnapshot<EmailSettings> settings,
    ILogger<ResendEmailService> logger
) : IEmailService
{
    public async Task SendVerificationEmailAsync(
        string toEmail,
        string userName,
        string verifyUrl,
        CancellationToken ct = default
    )
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Verify your email address";
        message.HtmlBody = EmailTemplates.Verification(settings.Value.BaseUrl, userName, verifyUrl);
        message.TextBody = EmailTemplates.VerificationPlainText(userName, verifyUrl);

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Verification email sent to {Email}", toEmail);
    }

    public async Task SendPasswordResetEmailAsync(
        string toEmail,
        string userName,
        string resetUrl,
        CancellationToken ct = default
    )
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Reset your password";
        message.HtmlBody = EmailTemplates.PasswordReset(settings.Value.BaseUrl, userName, resetUrl);
        message.TextBody = EmailTemplates.PasswordResetPlainText(userName, resetUrl);

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }

    public async Task SendAccountDeletionScheduledAsync(
        string toEmail,
        string userName,
        DateTime purgeDate,
        CancellationToken ct = default
    )
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Your account is scheduled for deletion";
        message.HtmlBody = EmailTemplates.DeletionScheduled(settings.Value.BaseUrl, userName, purgeDate);
        message.TextBody = EmailTemplates.DeletionScheduledPlainText(userName, purgeDate);

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Deletion scheduled email sent to {Email}", toEmail);
    }

    public async Task SendAccountDeletionCompletedAsync(
        string toEmail,
        string userName,
        CancellationToken ct = default
    )
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Your account has been deleted";
        message.HtmlBody = EmailTemplates.DeletionCompleted(settings.Value.BaseUrl, userName);
        message.TextBody = EmailTemplates.DeletionCompletedPlainText(userName);

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Deletion completed email sent to {Email}", toEmail);
    }

    public async Task SendInvitationEmailAsync(
        string toEmail,
        string inviterName,
        string workspaceName,
        string role,
        string acceptUrl,
        CancellationToken ct = default
    )
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = $"You've been invited to join {workspaceName} on Clarive";
        message.HtmlBody = EmailTemplates.Invitation(settings.Value.BaseUrl, inviterName, workspaceName, role, acceptUrl);
        message.TextBody = EmailTemplates.InvitationPlainText(inviterName, workspaceName, role, acceptUrl);

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Invitation email sent to {Email}", toEmail);
    }

    public async Task SendWorkspaceInviteEmailAsync(
        string toEmail,
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl,
        CancellationToken ct = default
    )
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = $"You've been invited to join {workspaceName} on Clarive";
        message.HtmlBody = EmailTemplates.WorkspaceInvite(
            settings.Value.BaseUrl,
            recipientName,
            workspaceName,
            role,
            inviterName,
            loginUrl
        );
        message.TextBody = EmailTemplates.WorkspaceInvitePlainText(
            recipientName,
            workspaceName,
            role,
            inviterName,
            loginUrl
        );

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Workspace invite email sent to {Email}", toEmail);
    }

    public async Task SendTestEmailAsync(string toEmail, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Clarive Test Email";
        message.HtmlBody = EmailTemplates.TestEmail(settings.Value.BaseUrl);
        message.TextBody = EmailTemplates.TestEmailPlainText();

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Test email sent to {Email}", toEmail);
    }

    public async Task SendPasswordChangedAsync(string toEmail, string userName, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Your password was changed";
        message.HtmlBody = EmailTemplates.PasswordChanged(settings.Value.BaseUrl, userName);
        message.TextBody = EmailTemplates.PasswordChangedPlainText(userName);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Password changed email sent to {Email}", toEmail);
    }

    public async Task SendEmailChangedAsync(string toEmail, string userName, string newEmail, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "Your email address was changed";
        message.HtmlBody = EmailTemplates.EmailChanged(settings.Value.BaseUrl, userName, newEmail);
        message.TextBody = EmailTemplates.EmailChangedPlainText(userName, newEmail);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Email changed notification sent to {Email}", toEmail);
    }

    public async Task SendApiKeyCreatedAsync(string toEmail, string userName, string keyName, string keyPrefix, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "New API key created";
        message.HtmlBody = EmailTemplates.ApiKeyCreated(settings.Value.BaseUrl, userName, keyName, keyPrefix);
        message.TextBody = EmailTemplates.ApiKeyCreatedPlainText(userName, keyName, keyPrefix);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("API key created email sent to {Email}", toEmail);
    }

    public async Task SendApiKeyRevokedAsync(string toEmail, string userName, string keyName, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = "API key revoked";
        message.HtmlBody = EmailTemplates.ApiKeyRevoked(settings.Value.BaseUrl, userName, keyName);
        message.TextBody = EmailTemplates.ApiKeyRevokedPlainText(userName, keyName);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("API key revoked email sent to {Email}", toEmail);
    }

    public async Task SendRoleChangedAsync(string toEmail, string userName, string workspaceName, string oldRole, string newRole, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = $"Your role in {workspaceName} was updated";
        message.HtmlBody = EmailTemplates.RoleChanged(settings.Value.BaseUrl, userName, workspaceName, oldRole, newRole);
        message.TextBody = EmailTemplates.RoleChangedPlainText(userName, workspaceName, oldRole, newRole);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Role changed email sent to {Email}", toEmail);
    }

    public async Task SendRemovedFromWorkspaceAsync(string toEmail, string userName, string workspaceName, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = $"You were removed from {workspaceName}";
        message.HtmlBody = EmailTemplates.RemovedFromWorkspace(settings.Value.BaseUrl, userName, workspaceName);
        message.TextBody = EmailTemplates.RemovedFromWorkspacePlainText(userName, workspaceName);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Removed from workspace email sent to {Email}", toEmail);
    }

    public async Task SendOwnershipTransferredAsync(string toEmail, string userName, string workspaceName, string fromName, string toName, CancellationToken ct = default)
    {
        var message = new EmailMessage();
        message.From = $"{settings.Value.FromName} <{settings.Value.FromAddress}>";
        message.To.Add(toEmail);
        message.Subject = $"Ownership of {workspaceName} was transferred";
        message.HtmlBody = EmailTemplates.OwnershipTransferred(settings.Value.BaseUrl, userName, workspaceName, fromName, toName);
        message.TextBody = EmailTemplates.OwnershipTransferredPlainText(userName, workspaceName, fromName, toName);
        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Ownership transferred email sent to {Email}", toEmail);
    }
}
