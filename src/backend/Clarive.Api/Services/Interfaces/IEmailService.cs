namespace Clarive.Api.Services.Interfaces;

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
}
