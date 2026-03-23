using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Clarive.Domain.Interfaces.Services;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Clarive.Infrastructure.Email;

public class SmtpEmailService(
    IConfiguration configuration,
    IOptionsSnapshot<EmailSettings> settings,
    ILogger<SmtpEmailService> logger
) : IEmailService
{
    public async Task SendVerificationEmailAsync(
        string toEmail,
        string userName,
        string verifyUrl,
        CancellationToken ct = default
    )
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            "Verify your email address",
            EmailTemplates.Verification(baseUrl, userName, verifyUrl),
            EmailTemplates.VerificationPlainText(userName, verifyUrl),
            ct
        );
        logger.LogInformation("Verification email sent to {Email}", toEmail);
    }

    public async Task SendPasswordResetEmailAsync(
        string toEmail,
        string userName,
        string resetUrl,
        CancellationToken ct = default
    )
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            "Reset your password",
            EmailTemplates.PasswordReset(baseUrl, userName, resetUrl),
            EmailTemplates.PasswordResetPlainText(userName, resetUrl),
            ct
        );
        logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }

    public async Task SendAccountDeletionScheduledAsync(
        string toEmail,
        string userName,
        DateTime purgeDate,
        CancellationToken ct = default
    )
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            "Your account is scheduled for deletion",
            EmailTemplates.DeletionScheduled(baseUrl, userName, purgeDate),
            EmailTemplates.DeletionScheduledPlainText(userName, purgeDate),
            ct
        );
        logger.LogInformation("Deletion scheduled email sent to {Email}", toEmail);
    }

    public async Task SendAccountDeletionCompletedAsync(
        string toEmail,
        string userName,
        CancellationToken ct = default
    )
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            "Your account has been deleted",
            EmailTemplates.DeletionCompleted(baseUrl, userName),
            EmailTemplates.DeletionCompletedPlainText(userName),
            ct
        );
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
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            $"You've been invited to join {workspaceName} on Clarive",
            EmailTemplates.Invitation(baseUrl, inviterName, workspaceName, role, acceptUrl),
            EmailTemplates.InvitationPlainText(inviterName, workspaceName, role, acceptUrl),
            ct
        );
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
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            $"You've been invited to join {workspaceName} on Clarive",
            EmailTemplates.WorkspaceInvite(
                baseUrl,
                recipientName,
                workspaceName,
                role,
                inviterName,
                loginUrl
            ),
            EmailTemplates.WorkspaceInvitePlainText(
                recipientName,
                workspaceName,
                role,
                inviterName,
                loginUrl
            ),
            ct
        );
        logger.LogInformation("Workspace invite email sent to {Email}", toEmail);
    }

    public async Task SendTestEmailAsync(string toEmail, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(
            toEmail,
            "Clarive Test Email",
            EmailTemplates.TestEmail(baseUrl),
            EmailTemplates.TestEmailPlainText(),
            ct
        );
        logger.LogInformation("Test email sent to {Email}", toEmail);
    }

    public async Task SendPasswordChangedAsync(string toEmail, string userName, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, "Your password was changed", EmailTemplates.PasswordChanged(baseUrl, userName), EmailTemplates.PasswordChangedPlainText(userName), ct);
        logger.LogInformation("Password changed email sent to {Email}", toEmail);
    }

    public async Task SendEmailChangedAsync(string toEmail, string userName, string newEmail, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, "Your email address was changed", EmailTemplates.EmailChanged(baseUrl, userName, newEmail), EmailTemplates.EmailChangedPlainText(userName, newEmail), ct);
        logger.LogInformation("Email changed notification sent to {Email}", toEmail);
    }

    public async Task SendApiKeyCreatedAsync(string toEmail, string userName, string keyName, string keyPrefix, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, "New API key created", EmailTemplates.ApiKeyCreated(baseUrl, userName, keyName, keyPrefix), EmailTemplates.ApiKeyCreatedPlainText(userName, keyName, keyPrefix), ct);
        logger.LogInformation("API key created email sent to {Email}", toEmail);
    }

    public async Task SendApiKeyRevokedAsync(string toEmail, string userName, string keyName, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, "API key revoked", EmailTemplates.ApiKeyRevoked(baseUrl, userName, keyName), EmailTemplates.ApiKeyRevokedPlainText(userName, keyName), ct);
        logger.LogInformation("API key revoked email sent to {Email}", toEmail);
    }

    public async Task SendRoleChangedAsync(string toEmail, string userName, string workspaceName, string oldRole, string newRole, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, $"Your role in {workspaceName} was updated", EmailTemplates.RoleChanged(baseUrl, userName, workspaceName, oldRole, newRole), EmailTemplates.RoleChangedPlainText(userName, workspaceName, oldRole, newRole), ct);
        logger.LogInformation("Role changed email sent to {Email}", toEmail);
    }

    public async Task SendRemovedFromWorkspaceAsync(string toEmail, string userName, string workspaceName, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, $"You were removed from {workspaceName}", EmailTemplates.RemovedFromWorkspace(baseUrl, userName, workspaceName), EmailTemplates.RemovedFromWorkspacePlainText(userName, workspaceName), ct);
        logger.LogInformation("Removed from workspace email sent to {Email}", toEmail);
    }

    public async Task SendOwnershipTransferredAsync(string toEmail, string userName, string workspaceName, string fromName, string toName, CancellationToken ct = default)
    {
        var baseUrl = settings.Value.BaseUrl;
        await SendAsync(toEmail, $"Ownership of {workspaceName} was transferred", EmailTemplates.OwnershipTransferred(baseUrl, userName, workspaceName, fromName, toName), EmailTemplates.OwnershipTransferredPlainText(userName, workspaceName, fromName, toName), ct);
        logger.LogInformation("Ownership transferred email sent to {Email}", toEmail);
    }

    private async Task SendAsync(string to, string subject, string htmlBody, string plainBody, CancellationToken ct)
    {
        var host = configuration["Email:SmtpHost"] ?? "";
        var port = int.TryParse(configuration["Email:SmtpPort"], out var p) ? p : 587;
        var username = configuration["Email:SmtpUsername"] ?? "";
        var password = configuration["Email:SmtpPassword"] ?? "";
        var useTls = !string.Equals(
            configuration["Email:SmtpUseTls"],
            "false",
            StringComparison.OrdinalIgnoreCase
        );

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.Value.FromName, settings.Value.FromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;

        var multipart = new MultipartAlternative();
        multipart.Add(new TextPart("plain") { Text = plainBody });
        multipart.Add(new TextPart("html") { Text = htmlBody });
        message.Body = multipart;

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
