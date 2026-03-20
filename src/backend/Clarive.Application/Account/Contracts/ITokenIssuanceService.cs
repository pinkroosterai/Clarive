using Clarive.Domain.Entities;

namespace Clarive.Application.Account.Contracts;

public interface ITokenIssuanceService
{
    Task<(string AccessToken, string RawRefreshToken, Guid RefreshTokenId)> IssueTokensAsync(
        User user,
        CancellationToken ct
    );
}
