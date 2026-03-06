using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class NullGoogleAuthService : IGoogleAuthService
{
    public bool IsConfigured => false;

    public Task<GoogleUserInfo> ValidateIdTokenAsync(string idToken, CancellationToken ct = default)
        => throw new InvalidOperationException("Google OAuth is not configured.");
}
