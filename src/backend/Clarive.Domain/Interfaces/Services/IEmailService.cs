namespace Clarive.Domain.Interfaces.Services;

public interface IEmailService
{
    Task SendVerificationEmailAsync(
        string toEmail,
        string userName,
        string verifyUrl,
        CancellationToken ct = default
    );
    Task SendPasswordResetEmailAsync(
        string toEmail,
        string userName,
        string resetUrl,
        CancellationToken ct = default
    );
    Task SendAccountDeletionScheduledAsync(
        string toEmail,
        string userName,
        DateTime purgeDate,
        CancellationToken ct = default
    );
    Task SendAccountDeletionCompletedAsync(
        string toEmail,
        string userName,
        CancellationToken ct = default
    );
    Task SendInvitationEmailAsync(
        string toEmail,
        string inviterName,
        string workspaceName,
        string role,
        string acceptUrl,
        CancellationToken ct = default
    );
    Task SendWorkspaceInviteEmailAsync(
        string toEmail,
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl,
        CancellationToken ct = default
    );
    Task SendTestEmailAsync(
        string toEmail,
        CancellationToken ct = default
    );
    Task SendPasswordChangedAsync(
        string toEmail,
        string userName,
        CancellationToken ct = default
    );
    Task SendEmailChangedAsync(
        string toEmail,
        string userName,
        string newEmail,
        CancellationToken ct = default
    );
    Task SendApiKeyCreatedAsync(
        string toEmail,
        string userName,
        string keyName,
        string keyPrefix,
        CancellationToken ct = default
    );
    Task SendApiKeyRevokedAsync(
        string toEmail,
        string userName,
        string keyName,
        CancellationToken ct = default
    );
    Task SendRoleChangedAsync(
        string toEmail,
        string userName,
        string workspaceName,
        string oldRole,
        string newRole,
        CancellationToken ct = default
    );
    Task SendRemovedFromWorkspaceAsync(
        string toEmail,
        string userName,
        string workspaceName,
        CancellationToken ct = default
    );
    Task SendOwnershipTransferredAsync(
        string toEmail,
        string userName,
        string workspaceName,
        string fromName,
        string toName,
        CancellationToken ct = default
    );
}
