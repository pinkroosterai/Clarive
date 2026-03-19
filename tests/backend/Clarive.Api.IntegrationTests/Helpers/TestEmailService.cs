using System.Collections.Concurrent;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Test email service that captures outgoing emails for assertion.
/// Invitation accept URLs are stored keyed by recipient email so tests
/// can retrieve the raw token needed for the accept flow.
/// </summary>
public class TestEmailService : IEmailService
{
    private static readonly ConcurrentDictionary<string, string> InvitationAcceptUrls = new();

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

    /// <summary>Clears all captured invitation URLs. Call between tests if needed.</summary>
    public static void Reset() => InvitationAcceptUrls.Clear();

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
}
