using Clarive.Api.Models.Results;

namespace Clarive.Api.Services.Interfaces;

public interface IAccountService
{
    /// <summary>
    /// Authenticates a user with email and password.
    /// Returns null if the credentials are invalid.
    /// </summary>
    Task<LoginResult?> LoginAsync(string email, string password, CancellationToken ct = default);

    /// <summary>
    /// Creates a new user with a personal workspace, membership, seeds starter templates,
    /// generates an email verification token, and issues auth tokens.
    /// Returns null if a user with the given email already exists.
    /// </summary>
    Task<RegisterResult?> RegisterAsync(string email, string name, string password, CancellationToken ct = default);

    /// <summary>
    /// Handles Google OAuth end-to-end: validates the ID token, finds or creates user,
    /// and issues auth tokens.
    /// Throws InvalidOperationException if the email already exists with a password-only account.
    /// Throws if the Google token is invalid.
    /// </summary>
    Task<GoogleAuthLoginResult> LoginWithGoogleAsync(string idToken, CancellationToken ct = default);

    /// <summary>
    /// Validates a refresh token, ensures user still has active workspace membership
    /// (falls back to personal workspace if revoked), syncs role, rotates tokens.
    /// Returns null if the refresh token is invalid or expired.
    /// </summary>
    Task<RefreshResult?> RefreshTokensAsync(string refreshToken, CancellationToken ct = default);

    /// <summary>
    /// Accepts a token-based invitation: creates user + personal workspace + memberships,
    /// seeds templates, deletes invitation, generates tokens.
    /// Returns null if the invitation is invalid/expired or user already exists.
    /// </summary>
    Task<InvitationAcceptResult?> AcceptInvitationAsync(string invitationToken, string name, string password, CancellationToken ct = default);
}
