using Clarive.Api.Services.Interfaces;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class GoogleAuthService : IGoogleAuthService
{
    private readonly IOptionsMonitor<GoogleAuthSettings> _optionsMonitor;

    public GoogleAuthService(IOptionsMonitor<GoogleAuthSettings> optionsMonitor)
    {
        _optionsMonitor = optionsMonitor;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_optionsMonitor.CurrentValue.ClientId);

    public async Task<GoogleUserInfo> ValidateIdTokenAsync(string idToken, CancellationToken ct = default)
    {
        var settings = _optionsMonitor.CurrentValue;

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
            new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [settings.ClientId]
            });

        return new GoogleUserInfo(
            GoogleId: payload.Subject,
            Email: payload.Email,
            Name: payload.Name ?? payload.Email.Split('@')[0]
        );
    }
}
