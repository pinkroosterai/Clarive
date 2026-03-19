using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Results;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface IInvitationService
{
    /// <summary>
    /// Creates an invitation for a new or existing user.
    /// Returns an error if validation fails (ALREADY_MEMBER, INVITATION_EXISTS), or a result on success.
    /// </summary>
    Task<ErrorOr<CreateInvitationResult>> CreateAsync(
        Guid tenantId,
        Guid invitedById,
        string inviterName,
        string email,
        UserRole role,
        CancellationToken ct = default
    );

    /// <summary>
    /// Validates an invitation token and returns invitation info.
    /// Returns null if the token is invalid or expired.
    /// </summary>
    Task<InvitationValidation?> ValidateAsync(string token, CancellationToken ct = default);

    /// <summary>
    /// Resends an invitation email, extending expiry by 7 days.
    /// Returns null if the invitation is not found.
    /// </summary>
    Task<ResendInvitationResult?> ResendAsync(
        Guid tenantId,
        Guid invitationId,
        string inviterName,
        CancellationToken ct = default
    );

    /// <summary>
    /// Revokes (deletes) an invitation.
    /// Returns the deleted invitation, or null if not found.
    /// </summary>
    Task<Invitation?> RevokeAsync(Guid tenantId, Guid invitationId, CancellationToken ct = default);

    /// <summary>
    /// Responds to a pending invitation (accept or decline) for an existing user.
    /// Returns an error if validation fails, or a result on success.
    /// </summary>
    Task<ErrorOr<RespondInvitationResult>> RespondAsync(
        Guid userId,
        Guid invitationId,
        bool accept,
        CancellationToken ct = default
    );

    /// <summary>
    /// Gets all pending (non-expired) invitations for a user, enriched with workspace/inviter info.
    /// </summary>
    Task<List<PendingInvitationInfo>> GetPendingAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Counts pending (non-expired) invitations for a user.
    /// </summary>
    Task<int> GetPendingCountAsync(Guid userId, CancellationToken ct = default);
}

public record InvitationValidation(string Email, string Role, string WorkspaceName);

public record PendingInvitationInfo(
    Guid Id,
    string WorkspaceName,
    string Role,
    string InvitedBy,
    DateTime CreatedAt,
    DateTime ExpiresAt
);
