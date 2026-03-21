using System.Collections.Concurrent;
using Clarive.Domain.Interfaces.Services;

namespace Clarive.Infrastructure.Presence;

public class InMemoryPresenceTracker : IPresenceTracker
{
    // connectionId → set of (tenantId, entryId) the connection has joined
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<(Guid TenantId, Guid EntryId), byte>> _connections = new();

    // (tenantId, entryId) → { userId → UserPresence }
    private readonly ConcurrentDictionary<(Guid TenantId, Guid EntryId), ConcurrentDictionary<string, UserPresence>> _entries = new();

    public Task<bool> AddUserAsync(Guid tenantId, Guid entryId, string connectionId, PresenceUserInfo user)
    {
        var key = (tenantId, entryId);

        // Track this connection's membership
        var connEntries = _connections.GetOrAdd(connectionId, _ => new());
        connEntries.TryAdd(key, 0);

        // Add or update user presence for this entry
        var entryUsers = _entries.GetOrAdd(key, _ => new());
        var isNew = false;

        entryUsers.AddOrUpdate(
            user.UserId,
            _ =>
            {
                isNew = true;
                return new UserPresence(user, [connectionId]);
            },
            (_, existing) =>
            {
                lock (existing)
                {
                    existing.ConnectionIds.Add(connectionId);
                    return existing;
                }
            });

        return Task.FromResult(isNew);
    }

    public Task<bool> RemoveUserAsync(Guid tenantId, Guid entryId, string connectionId)
    {
        var key = (tenantId, entryId);

        // Remove from connection tracking
        if (_connections.TryGetValue(connectionId, out var connEntries))
            connEntries.TryRemove(key, out _);

        if (!_entries.TryGetValue(key, out var entryUsers))
            return Task.FromResult(false);

        // Find the user for this connection
        foreach (var (userId, presence) in entryUsers)
        {
            lock (presence)
            {
                if (!presence.ConnectionIds.Remove(connectionId))
                    continue;

                if (presence.ConnectionIds.Count == 0)
                {
                    entryUsers.TryRemove(userId, out _);
                    CleanupEmptyEntry(key);
                    return Task.FromResult(true);
                }

                return Task.FromResult(false);
            }
        }

        return Task.FromResult(false);
    }

    public Task<List<PresenceUserInfo>> GetUsersAsync(Guid tenantId, Guid entryId)
    {
        var key = (tenantId, entryId);

        if (!_entries.TryGetValue(key, out var entryUsers))
            return Task.FromResult(new List<PresenceUserInfo>());

        var users = new List<PresenceUserInfo>();
        foreach (var presence in entryUsers.Values)
        {
            lock (presence)
            {
                users.Add(presence.Info with { State = presence.State });
            }
        }

        return Task.FromResult(users);
    }

    public Task UpdateStateAsync(Guid tenantId, Guid entryId, string userId, string state)
    {
        var key = (tenantId, entryId);

        if (_entries.TryGetValue(key, out var entryUsers)
            && entryUsers.TryGetValue(userId, out var presence))
        {
            lock (presence)
            {
                presence.State = state;
            }
        }

        return Task.CompletedTask;
    }

    public Task<List<(Guid EntryId, Guid TenantId)>> RemoveConnectionAsync(string connectionId)
    {
        var departed = new List<(Guid EntryId, Guid TenantId)>();

        if (!_connections.TryRemove(connectionId, out var connEntries))
            return Task.FromResult(departed);

        foreach (var key in connEntries.Keys)
        {
            if (!_entries.TryGetValue(key, out var entryUsers))
                continue;

            foreach (var (userId, presence) in entryUsers)
            {
                lock (presence)
                {
                    if (!presence.ConnectionIds.Remove(connectionId))
                        continue;

                    if (presence.ConnectionIds.Count == 0)
                    {
                        entryUsers.TryRemove(userId, out _);
                        CleanupEmptyEntry(key);
                        departed.Add((key.EntryId, key.TenantId));
                    }
                }
            }
        }

        return Task.FromResult(departed);
    }

    public Task<int> GetConnectionEntryCountAsync(string connectionId)
    {
        if (_connections.TryGetValue(connectionId, out var connEntries))
            return Task.FromResult(connEntries.Count);

        return Task.FromResult(0);
    }

    private void CleanupEmptyEntry((Guid TenantId, Guid EntryId) key)
    {
        if (_entries.TryGetValue(key, out var entryUsers) && entryUsers.IsEmpty)
            _entries.TryRemove(key, out _);
    }

    private class UserPresence(PresenceUserInfo info, HashSet<string> connectionIds)
    {
        public PresenceUserInfo Info { get; } = info;
        public HashSet<string> ConnectionIds { get; } = connectionIds;
        public string State { get; set; } = info.State;
    }
}
