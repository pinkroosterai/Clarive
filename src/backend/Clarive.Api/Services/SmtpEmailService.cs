using Clarive.Api.Services.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Clarive.Api.Services;

public class SmtpEmailService(
    IConfiguration configuration,
    IOptionsSnapshot<EmailSettings> settings,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    public async Task SendVerificationEmailAsync(string toEmail, string userName, string verifyUrl, CancellationToken ct = default)
    {
        await SendAsync(toEmail, "Verify your email address",
            EmailTemplates.Verification(userName, verifyUrl), ct);
        logger.LogInformation("Verification email sent to {Email}", toEmail);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string userName, string resetUrl, CancellationToken ct = default)
    {
        await SendAsync(toEmail, "Reset your password",
            EmailTemplates.PasswordReset(userName, resetUrl), ct);
        logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }

    public async Task SendAccountDeletionScheduledAsync(string toEmail, string userName, DateTime purgeDate, CancellationToken ct = default)
    {
        await SendAsync(toEmail, "Your account is scheduled for deletion",
            EmailTemplates.DeletionScheduled(userName, purgeDate), ct);
        logger.LogInformation("Deletion scheduled email sent to {Email}", toEmail);
    }

    public async Task SendAccountDeletionCompletedAsync(string toEmail, string userName, CancellationToken ct = default)
    {
        await SendAsync(toEmail, "Your account has been deleted",
            EmailTemplates.DeletionCompleted(userName), ct);
        logger.LogInformation("Deletion completed email sent to {Email}", toEmail);
    }

    public async Task SendInvitationEmailAsync(string toEmail, string inviterName, string workspaceName, string role, string acceptUrl, CancellationToken ct = default)
    {
        await SendAsync(toEmail, $"You've been invited to join {workspaceName} on Clarive",
            EmailTemplates.Invitation(inviterName, workspaceName, role, acceptUrl), ct);
        logger.LogInformation("Invitation email sent to {Email}", toEmail);
    }

    public async Task SendWorkspaceInviteEmailAsync(string toEmail, string recipientName, string workspaceName, string role, string inviterName, string loginUrl, CancellationToken ct = default)
    {
        await SendAsync(toEmail, $"You've been invited to join {workspaceName} on Clarive",
            EmailTemplates.WorkspaceInvite(recipientName, workspaceName, role, inviterName, loginUrl), ct);
        logger.LogInformation("Workspace invite email sent to {Email}", toEmail);
    }

    private async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct)
    {
        var host = configuration["Email:SmtpHost"] ?? "";
        var port = int.TryParse(configuration["Email:SmtpPort"], out var p) ? p : 587;
        var username = configuration["Email:SmtpUsername"] ?? "";
        var password = configuration["Email:SmtpPassword"] ?? "";
        var useTls = !string.Equals(configuration["Email:SmtpUseTls"], "false", StringComparison.OrdinalIgnoreCase);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.Value.FromName, settings.Value.FromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        client.Timeout = 30_000;
        var tlsOption = useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;
        await client.ConnectAsync(host, port, tlsOption, ct);

        if (!string.IsNullOrEmpty(username))
            await client.AuthenticateAsync(username, password, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
