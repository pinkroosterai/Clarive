using Clarive.Api.Models.Entities;

namespace Clarive.Api.Models.Results;

public record RegisterResult(User User, Tenant PersonalWorkspace, string RawVerificationToken);

public record GoogleAuthResult(User User, bool IsNewUser);

public record RefreshResult(User User, string AccessToken, string RawRefreshToken, Guid NewRefreshTokenId);

public record InvitationAcceptResult(User User, string AccessToken, string RawRefreshToken, Guid RefreshTokenId);
