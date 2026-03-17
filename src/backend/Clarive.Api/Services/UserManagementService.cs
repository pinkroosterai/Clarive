using Clarive.Api.Data;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Results;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using ErrorOr;

namespace Clarive.Api.Services;

public class UserManagementService(
    IUserRepository userRepo,
    ITenantMembershipRepository membershipRepo,
    IInvitationRepository invitationRepo,
    ClariveDbContext db) : IUserManagementService
{
    public async Task<MemberListResult> ListMembersAsync(
        Guid tenantId, int page, int pageSize, CancellationToken ct)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 50;

        var (users, _) = await userRepo.GetByTenantPagedAsync(tenantId, page, pageSize, ct);
        var activeInvitations = await invitationRepo.GetActiveByTenantAsync(tenantId, ct);

        // Opportunistic lazy cleanup of expired invitations
        _ = invitationRepo.DeleteExpiredAsync(tenantId, ct);

        var activeMembers = users.Select(u => new MemberInfo(
            u.Id, u.Email, u.Name, u.Role.ToString().ToLower(),
            "active", u.CreatedAt, null));

        var pendingMembers = activeInvitations.Select(i => new MemberInfo(
            i.Id, i.Email, null, i.Role.ToString().ToLower(),
            "pending", i.CreatedAt, i.ExpiresAt));

        var items = activeMembers
            .Concat(pendingMembers)
            .OrderBy(m => m.Status == "pending" ? 1 : 0)
            .ThenBy(m => m.Name ?? m.Email)
            .ToList();

        return new MemberListResult(items, items.Count, page, pageSize);
    }

    public async Task<ErrorOr<ChangeRoleResult>> ChangeRoleAsync(
        Guid tenantId, Guid targetUserId, UserRole newRole, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(tenantId, targetUserId, ct);
        if (user is null)
            return DomainErrors.UserNotFound;

        var oldRole = user.Role.ToString().ToLower();

        var membership = await membershipRepo.GetAsync(targetUserId, tenantId, ct);
        if (membership is null)
            return DomainErrors.MembershipNotFound;

        membership.Role = newRole;
        await membershipRepo.UpdateAsync(membership, ct);

        // Only update User.Role if this is their active workspace
        if (user.TenantId == tenantId)
        {
            user.Role = newRole;
            await userRepo.UpdateAsync(user, ct);
        }

        return new ChangeRoleResult(user, newRole.ToString().ToLower(), oldRole);
    }

    public async Task<ErrorOr<User>> RemoveMemberAsync(
        Guid tenantId, Guid targetUserId, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(tenantId, targetUserId, ct);
        if (user is null)
            return DomainErrors.UserNotFound;

        // Prevent removing the last admin
        var membership = await membershipRepo.GetAsync(targetUserId, tenantId, ct);
        if (membership is not null && membership.Role == UserRole.Admin)
        {
            var adminCount = await membershipRepo.CountAdminsAsync(tenantId, ct);
            if (adminCount <= 1)
                return Error.Conflict("LAST_ADMIN", "Cannot remove the last admin. Transfer ownership first.");
        }

        // Remove membership from this workspace
        await membershipRepo.DeleteAsync(targetUserId, tenantId, ct);

        // If user's active workspace was this tenant, switch to personal
        var userCrossTenant = await userRepo.GetByIdCrossTenantsAsync(targetUserId, ct);
        if (userCrossTenant is not null && userCrossTenant.TenantId == tenantId)
        {
            var remainingMemberships = await membershipRepo.GetByUserIdAsync(targetUserId, ct);
            var personal = remainingMemberships.FirstOrDefault(m => m.IsPersonal);
            if (personal is not null)
            {
                userCrossTenant.TenantId = personal.TenantId;
                userCrossTenant.Role = personal.Role;
                await userRepo.UpdateAsync(userCrossTenant, ct);
            }
        }

        // If user has no remaining memberships, delete the user entity
        var allMemberships = await membershipRepo.GetByUserIdAsync(targetUserId, ct);
        if (allMemberships.Count == 0)
        {
            await userRepo.DeleteAsync(tenantId, targetUserId, ct);
        }

        return user;
    }

    public async Task<ErrorOr<TransferOwnershipResult>> TransferOwnershipAsync(
        Guid tenantId, Guid currentUserId, Guid targetUserId, CancellationToken ct)
    {
        var targetUser = await userRepo.GetByIdAsync(tenantId, targetUserId, ct);
        if (targetUser is null)
            return DomainErrors.TargetUserNotFound;

        var currentUser = await userRepo.GetByIdAsync(tenantId, currentUserId, ct);
        if (currentUser is null)
            return DomainErrors.CurrentUserNotFound;

        await db.Database.InTransactionAsync(async () =>
        {
            // Update User.Role for both users
            currentUser.Role = UserRole.Editor;
            await userRepo.UpdateAsync(currentUser, ct);

            targetUser.Role = UserRole.Admin;
            await userRepo.UpdateAsync(targetUser, ct);

            // Dual-write: update TenantMembership roles
            var currentMembership = await membershipRepo.GetAsync(currentUserId, tenantId, ct);
            if (currentMembership is not null)
            {
                currentMembership.Role = UserRole.Editor;
                await membershipRepo.UpdateAsync(currentMembership, ct);
            }

            var targetMembership = await membershipRepo.GetAsync(targetUserId, tenantId, ct);
            if (targetMembership is not null)
            {
                targetMembership.Role = UserRole.Admin;
                await membershipRepo.UpdateAsync(targetMembership, ct);
            }
        }, ct);

        return new TransferOwnershipResult(currentUser, targetUser);
    }
}
