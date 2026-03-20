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
        message.HtmlBody = EmailTemplates.Verification(userName, verifyUrl);

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
        message.HtmlBody = EmailTemplates.PasswordReset(userName, resetUrl);

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
        message.HtmlBody = EmailTemplates.DeletionScheduled(userName, purgeDate);

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
        message.HtmlBody = EmailTemplates.DeletionCompleted(userName);

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
        message.HtmlBody = EmailTemplates.Invitation(inviterName, workspaceName, role, acceptUrl);

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
            recipientName,
            workspaceName,
            role,
            inviterName,
            loginUrl
        );

        await resend.EmailSendAsync(message, ct);
        logger.LogInformation("Workspace invite email sent to {Email}", toEmail);
    }
}
