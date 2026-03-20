using Clarive.Domain.Interfaces.Services;

namespace Clarive.Auth.Google;

public class NullGoogleAuthService : IGoogleAuthService
{
    public bool IsConfigured => false;

    public Task<GoogleUserInfo> ValidateIdTokenAsync(
        string idToken,
        string? nonce = null,
        CancellationToken ct = default
    ) => throw new InvalidOperationException("Google OAuth is not configured.");
}
