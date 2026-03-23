using System.Net;

namespace Clarive.Infrastructure.Email;

public static class EmailTemplates
{
    private const string BgColor = "#0a0a0f";
    private const string CardColor = "#18181b";
    private const string TextColor = "#e4e4e7";
    private const string MutedColor = "#71717a";
    private const string AccentColor = "#2cbeb8";
    private const string AccentBorderColor = "#239e99";
    private const string InfoBoxColor = "#1f1f23";
    private const string DividerColor = "#27272a";
    private const string LogoPath = "/static/logo.png";

    private const string BodyFont = "font-family:Arial,Helvetica,sans-serif;";
    private const string BodyTextStyle = $"{BodyFont}font-size:16px;line-height:1.6;color:{TextColor};";
    private const string MutedTextStyle = $"{BodyFont}font-size:13px;line-height:1.5;color:{MutedColor};";

    private static string HtmlEncode(string value) => WebUtility.HtmlEncode(value);

    private static string LogoUrl(string baseUrl) =>
        $"{baseUrl.TrimEnd('/')}{LogoPath}";

    private static string CtaButton(string text, string url) =>
        $"""
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
              <tr>
                <td style="border-radius:8px;background-color:{AccentColor};border:1px solid {AccentBorderColor};">
                  <a href="{HtmlEncode(url)}" target="_blank"
                     style="display:inline-block;padding:16px 36px;{BodyFont}font-size:16px;font-weight:bold;color:#0a0a0f;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                    {HtmlEncode(text)}
                  </a>
                </td>
              </tr>
            </table>
            """;

    private static string Divider() =>
        $"""
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
              <tr>
                <td style="border-top:1px solid {DividerColor};font-size:1px;line-height:1px;">&nbsp;</td>
              </tr>
            </table>
            """;

    private static string InfoBox(string content) =>
        $"""
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;">
              <tr>
                <td style="background-color:{InfoBoxColor};border-radius:8px;padding:16px 20px;">
                  {content}
                </td>
              </tr>
            </table>
            """;

    private static string WrapInLayout(string baseUrl, string title, string preheader, string bodyHtml) =>
        $"""
            <!DOCTYPE html>
            <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>{HtmlEncode(title)}</title>
            </head>
            <body style="margin:0;padding:0;background-color:{BgColor};{BodyFont}">
              <span style="display:none;font-size:1px;color:{BgColor};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
                {HtmlEncode(preheader)}
              </span>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:{BgColor};">
                <tr>
                  <td align="center" style="padding:40px 16px;">
                    <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
                      <!-- Header -->
                      <tr>
                        <td align="center" style="padding-bottom:24px;">
                          <img src="{HtmlEncode(LogoUrl(baseUrl))}" alt="Clarive" width="140" style="display:block;margin:0 auto;max-width:140px;height:auto;" />
                        </td>
                      </tr>
                      <!-- Card -->
                      <tr>
                        <td style="background-color:{CardColor};border-top:3px solid {AccentColor};border-radius:0 0 12px 12px;padding:40px 32px;">
                          {bodyHtml}
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td align="center" style="padding-top:24px;">
                          <p style="{BodyFont}font-size:12px;color:{MutedColor};margin:0;">
                            &copy; {DateTime.UtcNow.Year} Clarive. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;

    public static string Verification(string baseUrl, string userName, string verifyUrl)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 8px;">
              Thanks for signing up! Please verify your email address to get started.
            </p>
            {CtaButton("Verify Email", verifyUrl)}
            {Divider()}
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0 0 8px;">
                This link expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="{BodyFont}font-size:13px;line-height:1.5;color:{AccentColor};word-break:break-all;margin:0;">
                {HtmlEncode(verifyUrl)}
              </p>
            """)}
            """;
        return WrapInLayout(
            baseUrl,
            "Verify your email address",
            "Verify your email to get started with Clarive.",
            body
        );
    }

    public static string PasswordReset(string baseUrl, string userName, string resetUrl)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 8px;">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            {CtaButton("Reset Password", resetUrl)}
            {Divider()}
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0 0 8px;">
                This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
              <p style="{BodyFont}font-size:13px;line-height:1.5;color:{AccentColor};word-break:break-all;margin:0;">
                {HtmlEncode(resetUrl)}
              </p>
            """)}
            """;
        return WrapInLayout(baseUrl, "Reset your password", "Reset your Clarive password.", body);
    }

    public static string DeletionScheduled(string baseUrl, string userName, DateTime purgeDate)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Your account has been scheduled for deletion. All your data will be permanently removed on
              <strong>{purgeDate:MMMM d, yyyy}</strong>.
            </p>
            {Divider()}
            <p style="{BodyTextStyle}margin:0;">
              If you change your mind, simply log in before that date to cancel the deletion.
            </p>
            """;
        return WrapInLayout(
            baseUrl,
            "Your account is scheduled for deletion",
            $"Your Clarive account will be deleted on {purgeDate:MMMM d, yyyy}.",
            body
        );
    }

    public static string DeletionCompleted(string baseUrl, string userName)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Your account and all associated data have been permanently deleted.
            </p>
            {Divider()}
            <p style="{BodyTextStyle}margin:0;">
              If you'd like to use Clarive again in the future, you're welcome to create a new account anytime.
            </p>
            """;
        return WrapInLayout(
            baseUrl,
            "Your account has been deleted",
            "Your Clarive account has been permanently deleted.",
            body
        );
    }

    public static string Invitation(
        string baseUrl,
        string inviterName,
        string workspaceName,
        string role,
        string acceptUrl
    )
    {
        var article = role.StartsWith("e", StringComparison.OrdinalIgnoreCase) ? "an" : "a";
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi there,
            </p>
            <p style="{BodyTextStyle}margin:0 0 8px;">
              {HtmlEncode(inviterName)} has invited you to join <strong>{HtmlEncode(
                workspaceName
            )}</strong> on Clarive as {article} {HtmlEncode(role)}.
            </p>
            {CtaButton($"Join {workspaceName}", acceptUrl)}
            {Divider()}
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0 0 8px;">
                This invitation expires in 7 days. If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="{BodyFont}font-size:13px;line-height:1.5;color:{AccentColor};word-break:break-all;margin:0;">
                {HtmlEncode(acceptUrl)}
              </p>
            """)}
            """;
        return WrapInLayout(
            baseUrl,
            $"Join {workspaceName} on Clarive",
            $"{inviterName} invited you to join {workspaceName} on Clarive.",
            body
        );
    }

    public static string WorkspaceInvite(
        string baseUrl,
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl
    )
    {
        var article = role.StartsWith("e", StringComparison.OrdinalIgnoreCase) ? "an" : "a";
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(recipientName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 8px;">
              {HtmlEncode(inviterName)} has invited you to join <strong>{HtmlEncode(
                workspaceName
            )}</strong> on Clarive as {article} {HtmlEncode(role)}.
            </p>
            <p style="{BodyTextStyle}margin:16px 0 0;">
              Log in to accept or decline this invitation.
            </p>
            {CtaButton("Log in to respond", loginUrl)}
            {Divider()}
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0;">
                This invitation expires in 7 days.
              </p>
            """)}
            """;
        return WrapInLayout(
            baseUrl,
            $"You've been invited to {workspaceName}",
            $"{inviterName} invited you to join {workspaceName} on Clarive.",
            body
        );
    }

    public static string TestEmail(string baseUrl)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Test Email
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              This is a test email from Clarive. If you received this, your email configuration is working correctly.
            </p>
            {Divider()}
            <p style="{MutedTextStyle}margin:0;">
              No action is required — this email was sent from the Super Admin settings panel.
            </p>
            """;
        return WrapInLayout(
            baseUrl,
            "Clarive Test Email",
            "Your Clarive email configuration is working correctly.",
            body
        );
    }

    public static string PasswordChanged(string baseUrl, string userName)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Your password was successfully changed. If you made this change, no further action is needed.
            </p>
            {Divider()}
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0;">
                If you did not change your password, please reset it immediately or contact support.
              </p>
            """)}
            """;
        return WrapInLayout(baseUrl, "Your password was changed", "Your Clarive password was changed.", body);
    }

    public static string EmailChanged(string baseUrl, string userName, string newEmail)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Your email address has been changed to <strong>{HtmlEncode(newEmail)}</strong>.
            </p>
            {Divider()}
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0;">
                If you did not make this change, please contact support immediately to secure your account.
              </p>
            """)}
            """;
        return WrapInLayout(baseUrl, "Your email address was changed", "Your Clarive email was updated.", body);
    }

    public static string ApiKeyCreated(string baseUrl, string userName, string keyName, string keyPrefix)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              A new API key was created on your workspace:
            </p>
            {InfoBox($"""
              <p style="{MutedTextStyle}margin:0 0 4px;">
                <strong style="color:{TextColor};">Name:</strong> {HtmlEncode(keyName)}
              </p>
              <p style="{MutedTextStyle}margin:0;">
                <strong style="color:{TextColor};">Key:</strong> {HtmlEncode(keyPrefix)}
              </p>
            """)}
            {Divider()}
            <p style="{MutedTextStyle}margin:0;">
              If you did not create this key, revoke it immediately from your workspace settings.
            </p>
            """;
        return WrapInLayout(baseUrl, "New API key created", "A new API key was created on your Clarive workspace.", body);
    }

    public static string ApiKeyRevoked(string baseUrl, string userName, string keyName)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              The API key <strong>{HtmlEncode(keyName)}</strong> has been revoked and can no longer be used.
            </p>
            {Divider()}
            <p style="{MutedTextStyle}margin:0;">
              Any integrations using this key will stop working. If this was unintentional, create a new key from your workspace settings.
            </p>
            """;
        return WrapInLayout(baseUrl, "API key revoked", "An API key was revoked on your Clarive workspace.", body);
    }

    public static string RoleChanged(
        string baseUrl,
        string userName,
        string workspaceName,
        string oldRole,
        string newRole
    )
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Your role in <strong>{HtmlEncode(workspaceName)}</strong> has been changed from
              <strong>{HtmlEncode(oldRole)}</strong> to <strong>{HtmlEncode(newRole)}</strong>.
            </p>
            {Divider()}
            <p style="{MutedTextStyle}margin:0;">
              This change was made by a workspace administrator. If you have questions, contact your workspace admin.
            </p>
            """;
        return WrapInLayout(baseUrl, "Your role was updated", $"Your role in {workspaceName} was changed.", body);
    }

    public static string RemovedFromWorkspace(string baseUrl, string userName, string workspaceName)
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              You have been removed from the workspace <strong>{HtmlEncode(workspaceName)}</strong>.
            </p>
            {Divider()}
            <p style="{MutedTextStyle}margin:0;">
              You no longer have access to this workspace's prompts and settings. If you believe this was a mistake, contact the workspace administrator.
            </p>
            """;
        return WrapInLayout(baseUrl, "Removed from workspace", $"You were removed from {workspaceName}.", body);
    }

    public static string OwnershipTransferred(
        string baseUrl,
        string userName,
        string workspaceName,
        string fromName,
        string toName
    )
    {
        var body = $"""
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="{BodyTextStyle}margin:0 0 16px;">
              Ownership of <strong>{HtmlEncode(workspaceName)}</strong> has been transferred
              from <strong>{HtmlEncode(fromName)}</strong> to <strong>{HtmlEncode(toName)}</strong>.
            </p>
            {Divider()}
            <p style="{MutedTextStyle}margin:0;">
              The new owner now has full administrative control of this workspace.
            </p>
            """;
        return WrapInLayout(baseUrl, "Workspace ownership transferred", $"Ownership of {workspaceName} was transferred.", body);
    }

    // ── Plain Text Templates ──

    private static string WrapInPlainTextLayout(string body) =>
        $"""
        Clarive
        ========================

        {body.Trim()}

        ---
        © {DateTime.UtcNow.Year} Clarive. All rights reserved.
        """;

    public static string VerificationPlainText(string userName, string verifyUrl) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Thanks for signing up! Please verify your email address to get started.

          Verify Email: {verifyUrl}

        This link expires in 24 hours.
        """);

    public static string PasswordResetPlainText(string userName, string resetUrl) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        We received a request to reset your password. Use the link below to choose a new one.

          Reset Password: {resetUrl}

        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        """);

    public static string DeletionScheduledPlainText(string userName, DateTime purgeDate) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Your account has been scheduled for deletion. All your data will be permanently removed on {purgeDate:MMMM d, yyyy}.

        If you change your mind, simply log in before that date to cancel the deletion.
        """);

    public static string DeletionCompletedPlainText(string userName) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Your account and all associated data have been permanently deleted.

        If you'd like to use Clarive again in the future, you're welcome to create a new account anytime.
        """);

    public static string InvitationPlainText(
        string inviterName,
        string workspaceName,
        string role,
        string acceptUrl
    )
    {
        var article = role.StartsWith("e", StringComparison.OrdinalIgnoreCase) ? "an" : "a";
        return WrapInPlainTextLayout($"""
        Hi there,

        {inviterName} has invited you to join {workspaceName} on Clarive as {article} {role}.

          Join {workspaceName}: {acceptUrl}

        This invitation expires in 7 days.
        """);
    }

    public static string WorkspaceInvitePlainText(
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl
    )
    {
        var article = role.StartsWith("e", StringComparison.OrdinalIgnoreCase) ? "an" : "a";
        return WrapInPlainTextLayout($"""
        Hi {recipientName},

        {inviterName} has invited you to join {workspaceName} on Clarive as {article} {role}.

        Log in to accept or decline this invitation.

          Log in to respond: {loginUrl}

        This invitation expires in 7 days.
        """);
    }

    public static string TestEmailPlainText() =>
        WrapInPlainTextLayout("""
        Test Email

        This is a test email from Clarive. If you received this, your email configuration is working correctly.

        No action is required — this email was sent from the Super Admin settings panel.
        """);

    public static string PasswordChangedPlainText(string userName) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Your password was successfully changed. If you made this change, no further action is needed.

        If you did not change your password, please reset it immediately or contact support.
        """);

    public static string EmailChangedPlainText(string userName, string newEmail) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Your email address has been changed to {newEmail}.

        If you did not make this change, please contact support immediately to secure your account.
        """);

    public static string ApiKeyCreatedPlainText(string userName, string keyName, string keyPrefix) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        A new API key was created on your workspace:

          Name: {keyName}
          Key:  {keyPrefix}

        If you did not create this key, revoke it immediately from your workspace settings.
        """);

    public static string ApiKeyRevokedPlainText(string userName, string keyName) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        The API key "{keyName}" has been revoked and can no longer be used.

        Any integrations using this key will stop working. If this was unintentional, create a new key from your workspace settings.
        """);

    public static string RoleChangedPlainText(string userName, string workspaceName, string oldRole, string newRole) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Your role in {workspaceName} has been changed from {oldRole} to {newRole}.

        This change was made by a workspace administrator. If you have questions, contact your workspace admin.
        """);

    public static string RemovedFromWorkspacePlainText(string userName, string workspaceName) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        You have been removed from the workspace {workspaceName}.

        You no longer have access to this workspace's prompts and settings. If you believe this was a mistake, contact the workspace administrator.
        """);

    public static string OwnershipTransferredPlainText(string userName, string workspaceName, string fromName, string toName) =>
        WrapInPlainTextLayout($"""
        Hi {userName},

        Ownership of {workspaceName} has been transferred from {fromName} to {toName}.

        The new owner now has full administrative control of this workspace.
        """);
}
