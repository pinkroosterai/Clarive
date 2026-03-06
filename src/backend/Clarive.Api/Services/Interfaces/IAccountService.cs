using Clarive.Api.Models.Results;

namespace Clarive.Api.Services.Interfaces;

public interface IAccountService
{
    /// <summary>
    /// Creates a new user with a personal workspace, membership, seeds starter templates,
    /// and generates an email verification token.
    /// Returns null if a user with the given email already exists.
    /// </summary>
    Task<RegisterResult?> RegisterAsync(string email, string name, string password, CancellationToken ct = default);

    /// <summary>
    /// Handles Google OAuth: find by GoogleId → find by email and link → create new user.
    /// Throws InvalidOperationException if the Google token is invalid.
    /// </summary>
    Task<GoogleAuthResult> AuthenticateWithGoogleAsync(string idToken, CancellationToken ct = default);

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
