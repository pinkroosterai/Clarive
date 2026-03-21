namespace Clarive.Domain.Interfaces.Services;

public record PresenceUserInfo(string UserId, string Name, string? AvatarUrl, string State);

public interface IPresenceTracker
{
    /// <summary>
    /// Adds a user connection to an entry. Returns true if this is the user's first connection to the entry.
    /// </summary>
    Task<bool> AddUserAsync(Guid tenantId, Guid entryId, string connectionId, PresenceUserInfo user);

    /// <summary>
    /// Removes a user connection from an entry. Returns true if this was the user's last connection (fully departed).
    /// </summary>
    Task<bool> RemoveUserAsync(Guid tenantId, Guid entryId, string connectionId);

    /// <summary>
    /// Gets all users currently present on an entry within a tenant.
    /// </summary>
    Task<List<PresenceUserInfo>> GetUsersAsync(Guid tenantId, Guid entryId);

    /// <summary>
    /// Updates a user's state (viewing/editing) for an entry.
    /// </summary>
    Task UpdateStateAsync(Guid tenantId, Guid entryId, string userId, string state);

    /// <summary>
    /// Removes all tracked entries for a connection (called on disconnect).
    /// Returns the list of entry/tenant pairs where the user fully departed.
    /// </summary>
    Task<List<(Guid EntryId, Guid TenantId)>> RemoveConnectionAsync(string connectionId);

    /// <summary>
    /// Gets the number of entries a connection has joined (for rate limiting).
    /// </summary>
    Task<int> GetConnectionEntryCountAsync(string connectionId);
}
