using Microsoft.AspNetCore.Http;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Application.Common;

public static class LoginSessionHelper
{
    public static async Task RecordAsync(
        HttpContext ctx,
        ILoginSessionRepository sessionRepo,
        Guid userId,
        Guid refreshTokenId,
        CancellationToken ct
    )
    {
        var ua = ctx.Request.Headers.UserAgent.ToString();
        var (browser, os) = UserAgentParser.Parse(ua);

        await sessionRepo.CreateAsync(
            new LoginSession
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RefreshTokenId = refreshTokenId,
                IpAddress = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                UserAgent = ua.Length > 512 ? ua[..512] : ua,
                Browser = browser,
                Os = os,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );
    }
}
