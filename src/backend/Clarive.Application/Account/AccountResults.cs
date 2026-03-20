using Clarive.Domain.Entities;

namespace Clarive.Application.Account;

public record RegisterResult(
    User User,
    Tenant PersonalWorkspace,
    string? RawVerificationToken,
    string AccessToken,
    string RawRefreshToken,
    Guid RefreshTokenId
);

public record LoginResult(
    User User,
    string AccessToken,
    string RawRefreshToken,
    Guid RefreshTokenId
);

public record GoogleAuthLoginResult(
    User User,
    string AccessToken,
    string RawRefreshToken,
    Guid RefreshTokenId,
    bool IsNewUser
);

public record RefreshResult(
    User User,
    string AccessToken,
    string RawRefreshToken,
    Guid NewRefreshTokenId
);

public record InvitationAcceptResult(
    User User,
    string AccessToken,
    string RawRefreshToken,
    Guid RefreshTokenId
);
