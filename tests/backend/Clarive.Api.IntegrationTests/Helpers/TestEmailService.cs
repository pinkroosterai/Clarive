using System.Collections.Concurrent;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Test email service that captures outgoing emails for assertion.
/// Invitation accept URLs are stored keyed by recipient email so tests
/// can retrieve the raw token needed for the accept flow.
/// </summary>
public class TestEmailService : IEmailService
{
    private static readonly ConcurrentDictionary<string, string> InvitationAcceptUrls = new();
    private static readonly ConcurrentBag<(string Email, string Subject)> SentTestEmails = new();

    /// <summary>Gets all test emails that were sent.</summary>
    public static IReadOnlyList<(string Email, string Subject)> GetSentTestEmails() =>
        SentTestEmails.ToArray();

    /// <summary>Gets the invitation accept URL that was sent to the given email.</summary>
    public static string? GetInvitationUrl(string email)
    {
        InvitationAcceptUrls.TryGetValue(email.Trim().ToLowerInvariant(), out var url);
        return url;
    }

    /// <summary>Extracts the raw token from an accept URL like http://…/invite/accept?token=inv_abc123.</summary>
    public static string? ExtractToken(string acceptUrl)
    {
        var uri = new Uri(acceptUrl);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        return query["token"];
    }

    /// <summary>Clears all captured data. Call between tests if needed.</summary>
    public static void Reset()
    {
        InvitationAcceptUrls.Clear();
        SentTestEmails.Clear();
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
        InvitationAcceptUrls[toEmail.Trim().ToLowerInvariant()] = acceptUrl;
        return Task.CompletedTask;
    }

    public Task SendVerificationEmailAsync(
        string toEmail,
        string userName,
        string verifyUrl,
        CancellationToken ct = default
    ) => Task.CompletedTask;

    public Task SendPasswordResetEmailAsync(
        string toEmail,
        string userName,
        string resetUrl,
        CancellationToken ct = default
    ) => Task.CompletedTask;

    public Task SendAccountDeletionScheduledAsync(
        string toEmail,
        string userName,
        DateTime purgeDate,
        CancellationToken ct = default
    ) => Task.CompletedTask;

    public Task SendAccountDeletionCompletedAsync(
        string toEmail,
        string userName,
        CancellationToken ct = default
    ) => Task.CompletedTask;

    public Task SendWorkspaceInviteEmailAsync(
        string toEmail,
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl,
        CancellationToken ct = default
    ) => Task.CompletedTask;

    public Task SendTestEmailAsync(string toEmail, CancellationToken ct = default)
    {
        SentTestEmails.Add((toEmail, "Clarive Test Email"));
        return Task.CompletedTask;
    }

    public Task SendPasswordChangedAsync(string toEmail, string userName, CancellationToken ct = default) => Task.CompletedTask;
    public Task SendEmailChangedAsync(string toEmail, string userName, string newEmail, CancellationToken ct = default) => Task.CompletedTask;
    public Task SendApiKeyCreatedAsync(string toEmail, string userName, string keyName, string keyPrefix, CancellationToken ct = default) => Task.CompletedTask;
    public Task SendApiKeyRevokedAsync(string toEmail, string userName, string keyName, CancellationToken ct = default) => Task.CompletedTask;
    public Task SendRoleChangedAsync(string toEmail, string userName, string workspaceName, string oldRole, string newRole, CancellationToken ct = default) => Task.CompletedTask;
    public Task SendRemovedFromWorkspaceAsync(string toEmail, string userName, string workspaceName, CancellationToken ct = default) => Task.CompletedTask;
    public Task SendOwnershipTransferredAsync(string toEmail, string userName, string workspaceName, string fromName, string toName, CancellationToken ct = default) => Task.CompletedTask;
}
