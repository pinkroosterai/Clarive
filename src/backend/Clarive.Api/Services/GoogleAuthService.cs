using Clarive.Api.Services.Interfaces;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class GoogleAuthService : IGoogleAuthService
{
    private readonly GoogleAuthSettings _settings;

    public GoogleAuthService(IOptions<GoogleAuthSettings> settings)
    {
        _settings = settings.Value;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_settings.ClientId);

    public async Task<GoogleUserInfo> ValidateIdTokenAsync(string idToken, CancellationToken ct = default)
    {
        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
            new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_settings.ClientId]
            });

        return new GoogleUserInfo(
            GoogleId: payload.Subject,
            Email: payload.Email,
            Name: payload.Name ?? payload.Email.Split('@')[0]
        );
    }
}
