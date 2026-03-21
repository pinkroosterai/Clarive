using System.Security.Claims;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Clarive.Api.Hubs;

[Authorize]
public class PresenceHub(IPresenceTracker presenceTracker, IEntryRepository entryRepository) : Hub<IPresenceClient>
{
    private static readonly HashSet<string> ValidStates = ["viewing", "editing"];
    private const int MaxEntriesPerConnection = 20;

    public async Task JoinEntry(Guid entryId)
    {
        var (tenantId, userId, name) = ExtractClaims();

        // Verify the user can access this entry (tenant-scoped lookup)
        var entry = await entryRepository.GetByIdAsync(tenantId, entryId);
        if (entry is null)
            throw new HubException("Entry not found.");

        // Enforce per-connection entry limit
        var connectionEntryCount = await presenceTracker.GetConnectionEntryCountAsync(Context.ConnectionId);
        if (connectionEntryCount >= MaxEntriesPerConnection)
            throw new HubException("Too many entries joined.");

        var groupName = GroupName(tenantId, entryId);
        var user = new PresenceUserInfo(userId, name, null, "viewing");

        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        var isNew = await presenceTracker.AddUserAsync(tenantId, entryId, Context.ConnectionId, user);

        if (isNew)
        {
            await Clients.OthersInGroup(groupName).UserJoined(
                new PresenceUserDto(user.UserId, user.Name, user.AvatarUrl, user.State));
        }

        var currentUsers = await presenceTracker.GetUsersAsync(tenantId, entryId);
        await Clients.Caller.CurrentUsers(
            currentUsers.Select(u => new PresenceUserDto(u.UserId, u.Name, u.AvatarUrl, u.State)).ToList());
    }

    public async Task LeaveEntry(Guid entryId)
    {
        var (tenantId, userId, _) = ExtractClaims();
        var groupName = GroupName(tenantId, entryId);

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        var wasLast = await presenceTracker.RemoveUserAsync(tenantId, entryId, Context.ConnectionId);

        if (wasLast)
        {
            await Clients.Group(groupName).UserLeft(userId);
        }
    }

    public async Task UpdateEditingState(Guid entryId, string state)
    {
        if (!ValidStates.Contains(state))
            throw new HubException("Invalid state value.");

        var (tenantId, userId, _) = ExtractClaims();
        var groupName = GroupName(tenantId, entryId);

        await presenceTracker.UpdateStateAsync(tenantId, entryId, userId, state);
        await Clients.OthersInGroup(groupName).UserStateChanged(userId, state);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Extract claims once before iterating (Context.User is available during disconnect)
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        var affectedEntries = await presenceTracker.RemoveConnectionAsync(Context.ConnectionId);

        if (!string.IsNullOrEmpty(userId))
        {
            foreach (var (entryId, tenantId) in affectedEntries)
            {
                var groupName = GroupName(tenantId, entryId);
                await Clients.Group(groupName).UserLeft(userId);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private (Guid TenantId, string UserId, string Name) ExtractClaims()
    {
        var tenantClaim = Context.User?.FindFirstValue("tenantId")
            ?? throw new HubException("Missing tenantId claim.");
        var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new HubException("Missing user identifier claim.");
        var name = Context.User?.FindFirstValue(ClaimTypes.Name) ?? "Unknown";

        return (Guid.Parse(tenantClaim), userId, name);
    }

    private static string GroupName(Guid tenantId, Guid entryId)
        => $"entry:{tenantId}:{entryId}";
}
