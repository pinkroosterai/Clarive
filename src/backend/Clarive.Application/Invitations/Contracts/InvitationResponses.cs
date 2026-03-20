using Clarive.Domain.Entities;

namespace Clarive.Application.Invitations.Contracts;

public record CreateInvitationResult(Invitation Invitation, bool IsExistingUser, string? RawToken);

public record ResendInvitationResult(
    Invitation Invitation,
    bool IsExistingUser,
    string? RawToken,
    string? TargetUserName
);

public record RespondInvitationResult(
    bool Accepted,
    TenantMembership? Membership,
    string? WorkspaceName,
    int? MemberCount,
    string? AvatarUrl
);
