using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;

namespace Clarive.Api.Helpers;

public static class LoginSessionHelper
{
    public static async Task RecordAsync(
        HttpContext ctx,
        ILoginSessionRepository sessionRepo,
        Guid userId,
        Guid refreshTokenId,
        CancellationToken ct)
    {
        var ua = ctx.Request.Headers.UserAgent.ToString();
        var (browser, os) = UserAgentParser.Parse(ua);

        await sessionRepo.CreateAsync(new LoginSession
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            RefreshTokenId = refreshTokenId,
            IpAddress = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            UserAgent = ua.Length > 512 ? ua[..512] : ua,
            Browser = browser,
            Os = os,
            CreatedAt = DateTime.UtcNow
        }, ct);
    }
}
