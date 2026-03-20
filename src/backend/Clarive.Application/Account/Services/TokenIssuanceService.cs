using Clarive.Auth.Jwt;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;

namespace Clarive.Application.Account.Services;

public class TokenIssuanceService(
    JwtService jwtService,
    IRefreshTokenRepository refreshTokenRepo
) : ITokenIssuanceService
{
    public async Task<(
        string AccessToken,
        string RawRefreshToken,
        Guid RefreshTokenId
    )> IssueTokensAsync(User user, CancellationToken ct)
    {
        var accessToken = jwtService.GenerateToken(user);
        var (rawRefresh, refreshHash) = jwtService.GenerateRefreshToken();
        var refreshTokenId = Guid.NewGuid();

        await refreshTokenRepo.CreateAsync(
            new RefreshToken
            {
                Id = refreshTokenId,
                UserId = user.Id,
                TokenHash = refreshHash,
                ExpiresAt = DateTime.UtcNow.AddDays(jwtService.RefreshTokenExpirationDays),
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        return (accessToken, rawRefresh, refreshTokenId);
    }
}
