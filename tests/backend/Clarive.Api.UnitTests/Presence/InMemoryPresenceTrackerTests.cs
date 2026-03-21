using Clarive.Domain.Interfaces.Services;
using Clarive.Infrastructure.Presence;

namespace Clarive.Api.UnitTests.Presence;

public class InMemoryPresenceTrackerTests
{
    private readonly InMemoryPresenceTracker _tracker = new();
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();
    private static readonly Guid Entry1 = Guid.NewGuid();
    private static readonly Guid Entry2 = Guid.NewGuid();

    private static PresenceUserInfo MakeUser(string id, string name = "Test")
        => new(id, name, null, "viewing");

    [Fact]
    public async Task AddUser_FirstConnection_ReturnsTrue()
    {
        var result = await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));

        Assert.True(result);
    }

    [Fact]
    public async Task AddUser_SecondConnectionSameUser_ReturnsFalse()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));

        var result = await _tracker.AddUserAsync(TenantA, Entry1, "conn-2", MakeUser("user-1"));

        Assert.False(result);
    }

    [Fact]
    public async Task RemoveUser_WithRemainingConnections_ReturnsFalse()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-2", MakeUser("user-1"));

        var result = await _tracker.RemoveUserAsync(TenantA, Entry1, "conn-1");

        Assert.False(result);
    }

    [Fact]
    public async Task RemoveUser_LastConnection_ReturnsTrue()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));

        var result = await _tracker.RemoveUserAsync(TenantA, Entry1, "conn-1");

        Assert.True(result);
    }

    [Fact]
    public async Task GetUsers_ReturnsOnlyUsersForSpecifiedTenantAndEntry()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1", "Alice"));
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-2", MakeUser("user-2", "Bob"));
        await _tracker.AddUserAsync(TenantA, Entry2, "conn-3", MakeUser("user-3", "Charlie"));

        var users = await _tracker.GetUsersAsync(TenantA, Entry1);

        Assert.Equal(2, users.Count);
        Assert.Contains(users, u => u.UserId == "user-1");
        Assert.Contains(users, u => u.UserId == "user-2");
    }

    [Fact]
    public async Task GetUsers_TenantIsolation_DifferentTenantsDoNotSeeEachOther()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1", "Alice"));
        await _tracker.AddUserAsync(TenantB, Entry1, "conn-2", MakeUser("user-2", "Bob"));

        var usersA = await _tracker.GetUsersAsync(TenantA, Entry1);
        var usersB = await _tracker.GetUsersAsync(TenantB, Entry1);

        Assert.Single(usersA);
        Assert.Equal("user-1", usersA[0].UserId);
        Assert.Single(usersB);
        Assert.Equal("user-2", usersB[0].UserId);
    }

    [Fact]
    public async Task UpdateState_ChangesUserState()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));

        await _tracker.UpdateStateAsync(TenantA, Entry1, "user-1", "editing");

        var users = await _tracker.GetUsersAsync(TenantA, Entry1);
        Assert.Single(users);
        Assert.Equal("editing", users[0].State);
    }

    [Fact]
    public async Task RemoveConnection_CleansUpAllEntriesAndReturnsAffected()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));
        await _tracker.AddUserAsync(TenantA, Entry2, "conn-1", MakeUser("user-1"));

        var affected = await _tracker.RemoveConnectionAsync("conn-1");

        Assert.Equal(2, affected.Count);
        Assert.Empty(await _tracker.GetUsersAsync(TenantA, Entry1));
        Assert.Empty(await _tracker.GetUsersAsync(TenantA, Entry2));
    }

    [Fact]
    public async Task RemoveConnection_WithMultipleTabs_OnlyDepartsWhenLastConnectionRemoved()
    {
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1"));
        await _tracker.AddUserAsync(TenantA, Entry1, "conn-2", MakeUser("user-1"));

        var affected = await _tracker.RemoveConnectionAsync("conn-1");

        Assert.Empty(affected); // User still has conn-2
        var users = await _tracker.GetUsersAsync(TenantA, Entry1);
        Assert.Single(users);
    }

    [Fact]
    public async Task MultiTabSupport_ThreeTabsOpenAndClose()
    {
        // Open 3 tabs
        Assert.True(await _tracker.AddUserAsync(TenantA, Entry1, "conn-1", MakeUser("user-1")));
        Assert.False(await _tracker.AddUserAsync(TenantA, Entry1, "conn-2", MakeUser("user-1")));
        Assert.False(await _tracker.AddUserAsync(TenantA, Entry1, "conn-3", MakeUser("user-1")));

        // Still shows as 1 user
        var users = await _tracker.GetUsersAsync(TenantA, Entry1);
        Assert.Single(users);

        // Close 2 tabs
        Assert.False(await _tracker.RemoveUserAsync(TenantA, Entry1, "conn-1"));
        Assert.False(await _tracker.RemoveUserAsync(TenantA, Entry1, "conn-2"));

        // Still present
        users = await _tracker.GetUsersAsync(TenantA, Entry1);
        Assert.Single(users);

        // Close last tab
        Assert.True(await _tracker.RemoveUserAsync(TenantA, Entry1, "conn-3"));

        // Gone
        users = await _tracker.GetUsersAsync(TenantA, Entry1);
        Assert.Empty(users);
    }

    [Fact]
    public async Task ConcurrentAccess_AddAndRemoveFromMultipleThreads()
    {
        var tasks = new List<Task>();
        for (int i = 0; i < 50; i++)
        {
            var connId = $"conn-{i}";
            var userId = $"user-{i % 10}";
            tasks.Add(Task.Run(async () =>
            {
                await _tracker.AddUserAsync(TenantA, Entry1, connId, MakeUser(userId));
                await _tracker.RemoveUserAsync(TenantA, Entry1, connId);
            }));
        }

        await Task.WhenAll(tasks);

        var users = await _tracker.GetUsersAsync(TenantA, Entry1);
        Assert.Empty(users);
    }
}
