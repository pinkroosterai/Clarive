using ErrorOr;

namespace Clarive.Application.Account.Contracts;

public interface IAccountService
{
    /// <summary>
    /// Authenticates a user with email and password.
    /// Returns Error.Unauthorized if the credentials are invalid.
    /// </summary>
    Task<ErrorOr<LoginResult>> LoginAsync(
        string email,
        string password,
        CancellationToken ct = default
    );

    /// <summary>
    /// Creates a new user with a personal workspace, membership, seeds starter templates,
    /// generates an email verification token, and issues auth tokens.
    /// Returns Error.Conflict if a user with the given email already exists.
    /// </summary>
    Task<ErrorOr<RegisterResult>> RegisterAsync(
        string email,
        string name,
        string password,
        CancellationToken ct = default
    );

    /// <summary>
    /// Handles Google OAuth end-to-end: validates the ID token, finds or creates user,
    /// and issues auth tokens.
    /// Returns Error.Conflict if the email already exists with a password-only account.
    /// Returns Error.Unauthorized if the Google token is invalid.
    /// </summary>
    Task<ErrorOr<GoogleAuthLoginResult>> LoginWithGoogleAsync(
        string idToken,
        string? nonce = null,
        CancellationToken ct = default
    );

    /// <summary>
    /// Validates a refresh token, ensures user still has active workspace membership
    /// (falls back to personal workspace if revoked), syncs role, rotates tokens.
    /// Returns Error.Unauthorized if the refresh token is invalid or expired.
    /// </summary>
    Task<ErrorOr<RefreshResult>> RefreshTokensAsync(
        string refreshToken,
        CancellationToken ct = default
    );

    /// <summary>
    /// Accepts a token-based invitation: creates user + personal workspace + memberships,
    /// seeds templates, deletes invitation, generates tokens.
    /// Returns Error.Validation if the invitation is invalid/expired.
    /// Returns Error.Conflict if the user already exists.
    /// </summary>
    Task<ErrorOr<InvitationAcceptResult>> AcceptInvitationAsync(
        string invitationToken,
        string name,
        string password,
        CancellationToken ct = default
    );
}
