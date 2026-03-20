using System.Net;

namespace Clarive.Infrastructure.Email;

public static class EmailTemplates
{
    private const string BgColor = "#0a0a0f";
    private const string CardColor = "#18181b";
    private const string TextColor = "#e4e4e7";
    private const string MutedColor = "#71717a";
    private const string AccentColor = "#2cbeb8";

    private static string HtmlEncode(string value) => WebUtility.HtmlEncode(value);

    private static string CtaButton(string text, string url) =>
        $"""
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
              <tr>
                <td style="border-radius:8px;background-color:{AccentColor};">
                  <a href="{HtmlEncode(url)}" target="_blank"
                     style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#0a0a0f;text-decoration:none;border-radius:8px;">
                    {HtmlEncode(text)}
                  </a>
                </td>
              </tr>
            </table>
            """;

    private static string WrapInLayout(string title, string preheader, string bodyHtml) =>
        $"""
            <!DOCTYPE html>
            <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>{HtmlEncode(title)}</title>
            </head>
            <body style="margin:0;padding:0;background-color:{BgColor};font-family:Arial,Helvetica,sans-serif;">
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
                          <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:bold;color:{AccentColor};letter-spacing:-0.5px;">
                            Clarive
                          </span>
                        </td>
                      </tr>
                      <!-- Card -->
                      <tr>
                        <td style="background-color:{CardColor};border-radius:12px;padding:40px 32px;">
                          {bodyHtml}
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td align="center" style="padding-top:24px;">
                          <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:{MutedColor};margin:0;">
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

    public static string Verification(string userName, string verifyUrl)
    {
        var body = $"""
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 8px;">
              Thanks for signing up! Please verify your email address to get started.
            </p>
            {CtaButton("Verify Email", verifyUrl)}
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MutedColor};margin:16px 0 0;">
              This link expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{AccentColor};word-break:break-all;margin:4px 0 0;">
              {HtmlEncode(verifyUrl)}
            </p>
            """;
        return WrapInLayout(
            "Verify your email address",
            "Verify your email to get started with Clarive.",
            body
        );
    }

    public static string PasswordReset(string userName, string resetUrl)
    {
        var body = $"""
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 8px;">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            {CtaButton("Reset Password", resetUrl)}
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MutedColor};margin:16px 0 0;">
              This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{AccentColor};word-break:break-all;margin:4px 0 0;">
              {HtmlEncode(resetUrl)}
            </p>
            """;
        return WrapInLayout("Reset your password", "Reset your Clarive password.", body);
    }

    public static string DeletionScheduled(string userName, DateTime purgeDate)
    {
        var body = $"""
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 8px;">
              Your account has been scheduled for deletion. All your data will be permanently removed on
              <strong>{purgeDate:MMMM d, yyyy}</strong>.
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:16px 0 0;">
              If you change your mind, simply log in before that date to cancel the deletion.
            </p>
            """;
        return WrapInLayout(
            "Your account is scheduled for deletion",
            $"Your Clarive account will be deleted on {purgeDate:MMMM d, yyyy}.",
            body
        );
    }

    public static string DeletionCompleted(string userName)
    {
        var body = $"""
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 16px;">
              Hi {HtmlEncode(userName)},
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 8px;">
              Your account and all associated data have been permanently deleted.
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:16px 0 0;">
              If you'd like to use Clarive again in the future, you're welcome to create a new account anytime.
            </p>
            """;
        return WrapInLayout(
            "Your account has been deleted",
            "Your Clarive account has been permanently deleted.",
            body
        );
    }

    public static string Invitation(
        string inviterName,
        string workspaceName,
        string role,
        string acceptUrl
    )
    {
        var article = role.StartsWith("e", StringComparison.OrdinalIgnoreCase) ? "an" : "a";
        var body = $"""
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 16px;">
              Hi there,
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 8px;">
              {HtmlEncode(inviterName)} has invited you to join <strong>{HtmlEncode(
                workspaceName
            )}</strong> on Clarive as {article} {HtmlEncode(role)}.
            </p>
            {CtaButton($"Join {workspaceName}", acceptUrl)}
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MutedColor};margin:16px 0 0;">
              This invitation expires in 7 days. If the button doesn't work, copy and paste this URL into your browser:
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{AccentColor};word-break:break-all;margin:4px 0 0;">
              {HtmlEncode(acceptUrl)}
            </p>
            """;
        return WrapInLayout(
            $"Join {workspaceName} on Clarive",
            $"{inviterName} invited you to join {workspaceName} on Clarive.",
            body
        );
    }

    public static string WorkspaceInvite(
        string recipientName,
        string workspaceName,
        string role,
        string inviterName,
        string loginUrl
    )
    {
        var article = role.StartsWith("e", StringComparison.OrdinalIgnoreCase) ? "an" : "a";
        var body = $"""
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 16px;">
              Hi {HtmlEncode(recipientName)},
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:0 0 8px;">
              {HtmlEncode(inviterName)} has invited you to join <strong>{HtmlEncode(
                workspaceName
            )}</strong> on Clarive as {article} {HtmlEncode(role)}.
            </p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:{TextColor};margin:16px 0 0;">
              Log in to accept or decline this invitation.
            </p>
            {CtaButton("Log in to respond", loginUrl)}
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:{MutedColor};margin:16px 0 0;">
              This invitation expires in 7 days.
            </p>
            """;
        return WrapInLayout(
            $"You've been invited to {workspaceName}",
            $"{inviterName} invited you to join {workspaceName} on Clarive.",
            body
        );
    }
}
