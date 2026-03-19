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
    IApiKeyRepository keyRepo,
    IServiceScopeFactory scopeFactory
) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
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
            Logger.LogWarning(
                "API key auth failed: empty key on {Path} from {ClientIp}",
                Request.Path,
                Context.Connection.RemoteIpAddress
            );
            return AuthenticateResult.Fail("API key is empty.");
        }

        var hash = ApiKeyEndpoints.HashKey(rawKey);
        var apiKey = await keyRepo.GetByHashAsync(hash, Context.RequestAborted);
        if (apiKey is null)
        {
            Logger.LogWarning(
                "API key auth failed: invalid key on {Path} from {ClientIp}",
                Request.Path,
                Context.Connection.RemoteIpAddress
            );
            return AuthenticateResult.Fail("Invalid API key.");
        }

        if (apiKey.ExpiresAt.HasValue && apiKey.ExpiresAt.Value < DateTime.UtcNow)
        {
            Logger.LogWarning(
                "API key auth failed: expired key {ApiKeyId} on {Path} from {ClientIp}",
                apiKey.Id,
                Request.Path,
                Context.Connection.RemoteIpAddress
            );
            return AuthenticateResult.Fail("API key has expired.");
        }

        // Fire-and-forget: update last-used timestamp in a new scope (the request-scoped
        // DbContext may be disposed before this completes)
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var repo = scope.ServiceProvider.GetRequiredService<IApiKeyRepository>();
                await repo.TouchLastUsedAsync(apiKey.Id, CancellationToken.None);
            }
            catch (Exception ex)
            {
                Logger.LogWarning(
                    ex,
                    "Failed to update LastUsedAt for API key {ApiKeyId}",
                    apiKey.Id
                );
            }
        });

        var claims = new[]
        {
            new Claim("tenantId", apiKey.TenantId.ToString()),
            new Claim("apiKeyId", apiKey.Id.ToString()),
            new Claim("apiKeyName", apiKey.Name),
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}
