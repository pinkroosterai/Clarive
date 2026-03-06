using System.Security.Claims;
using System.Text.Encodings.Web;
using Clarive.Api.Endpoints;
using Clarive.Api.Repositories.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Auth;

public class ApiKeyAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IApiKeyRepository keyRepo)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ApiKey";
    public const string HeaderName = "X-Api-Key";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var headerValue))
            return AuthenticateResult.NoResult();

        var rawKey = headerValue.ToString();
        if (string.IsNullOrWhiteSpace(rawKey))
        {
            Logger.LogWarning("API key auth failed: empty key on {Path} from {ClientIp}",
                Request.Path, Context.Connection.RemoteIpAddress);
            return AuthenticateResult.Fail("API key is empty.");
        }

        var hash = ApiKeyEndpoints.HashKey(rawKey);
        var apiKey = await keyRepo.GetByHashAsync(hash, Context.RequestAborted);
        if (apiKey is null)
        {
            Logger.LogWarning("API key auth failed: invalid key on {Path} from {ClientIp}",
                Request.Path, Context.Connection.RemoteIpAddress);
            return AuthenticateResult.Fail("Invalid API key.");
        }

        var claims = new[]
        {
            new Claim("tenantId", apiKey.TenantId.ToString()),
            new Claim("apiKeyId", apiKey.Id.ToString()),
            new Claim("apiKeyName", apiKey.Name)
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}
