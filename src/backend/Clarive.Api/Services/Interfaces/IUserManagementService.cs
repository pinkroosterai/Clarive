using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Results;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface IUserManagementService
{
    /// <summary>
    /// Lists active members and pending invitations for a workspace.
    /// </summary>
    Task<MemberListResult> ListMembersAsync(
        Guid tenantId, int page, int pageSize, CancellationToken ct = default);

    /// <summary>
    /// Changes a user's role in a workspace. Updates both membership and user entity.
    /// Returns an error if the user is not found or membership doesn't exist.
    /// </summary>
    Task<ErrorOr<ChangeRoleResult>> ChangeRoleAsync(
        Guid tenantId, Guid targetUserId, UserRole newRole, CancellationToken ct = default);

    /// <summary>
    /// Removes a user from a workspace. Falls back their active workspace to personal if needed.
    /// Deletes the user entity if they have no remaining memberships.
    /// Returns an error if the user is not found or is the last admin.
    /// </summary>
    Task<ErrorOr<User>> RemoveMemberAsync(
        Guid tenantId, Guid targetUserId, CancellationToken ct = default);

    /// <summary>
    /// Transfers workspace ownership: current admin becomes editor, target user becomes admin.
    /// Runs in a transaction. Returns an error if either user is not found.
    /// </summary>
    Task<ErrorOr<TransferOwnershipResult>> TransferOwnershipAsync(
        Guid tenantId, Guid currentUserId, Guid targetUserId, CancellationToken ct = default);
}

public record MemberListResult(List<MemberInfo> Items, int Total, int Page, int PageSize);

public record MemberInfo(
    Guid Id, string Email, string? Name, string Role,
    string Status, DateTime CreatedAt, DateTime? ExpiresAt);

public record ChangeRoleResult(User User, string NewRole, string OldRole);
