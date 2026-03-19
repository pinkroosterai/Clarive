using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.Data;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Workspaces;

[Collection("Integration")]
public class WorkspaceTests : IntegrationTestBase
{
    public WorkspaceTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    // ── Registration creates personal membership ──

    [Fact]
    public async Task Register_CreatesPersonalMembership()
    {
        var email = TestData.UniqueEmail();
        var response = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = "securepassword123",
                name = "Workspace Tester",
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();

        // Response should contain workspaces with exactly one personal workspace
        json.TryGetProperty("workspaces", out var workspaces).Should().BeTrue();
        workspaces.GetArrayLength().Should().Be(1);

        var ws = workspaces[0];
        ws.GetProperty("isPersonal").GetBoolean().Should().BeTrue();
        ws.GetProperty("role").GetString().Should().Be("admin");
        ws.GetProperty("name").GetString().Should().ContainEquivalentOf("workspace");
    }

    // ── Login returns workspace list ──

    [Fact]
    public async Task Login_ReturnsWorkspaceList()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = TestData.AdminEmail, password = TestData.SeedPassword }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();

        json.TryGetProperty("workspaces", out var workspaces).Should().BeTrue();
        workspaces.GetArrayLength().Should().BeGreaterOrEqualTo(1);
    }

    // ── List workspaces ──

    [Fact]
    public async Task ListWorkspaces_ReturnsAllMemberships()
    {
        // Register a new user and invite them to the admin workspace
        var (token, _) = await RegisterAndInviteToAdminWorkspaceAsync();

        Client.WithBearerToken(token);
        var response = await Client.GetAsync("/api/workspaces");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        var workspaces = json.GetProperty("workspaces");

        // Should have at least personal + invited workspace
        workspaces.GetArrayLength().Should().BeGreaterOrEqualTo(2);

        var hasPersonal = workspaces
            .EnumerateArray()
            .Any(w => w.GetProperty("isPersonal").GetBoolean());
        hasPersonal.Should().BeTrue();
    }

    // ── Switch workspace ──

    [Fact]
    public async Task SwitchWorkspace_ValidMembership_ReturnsNewToken()
    {
        var (token, personalTenantId) = await RegisterAndInviteToAdminWorkspaceAsync();

        // User is currently in admin's workspace; switch to personal
        Client.WithBearerToken(token);
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/switch-workspace",
            new { tenantId = personalTenantId }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.TryGetProperty("token", out _).Should().BeTrue();
        body.GetProperty("user").GetProperty("role").GetString().Should().Be("admin");
    }

    [Fact]
    public async Task SwitchWorkspace_NotMember_Returns403()
    {
        // Register a fresh user
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = "securepassword123",
                name = "Switcher",
            }
        );
        regResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;

        // Try to switch to the seed tenant (not a member)
        Client.WithBearerToken(token);
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/switch-workspace",
            new { tenantId = TestData.TenantId }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SwitchWorkspace_UpdatesUserTenantId()
    {
        var (token, personalTenantId) = await RegisterAndInviteToAdminWorkspaceAsync();

        // Switch to personal workspace
        Client.WithBearerToken(token);
        var (switchRes, switchBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/switch-workspace",
            new { tenantId = personalTenantId }
        );
        switchRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // After switching, the returned user's role should be "admin" (personal workspace role)
        var switchedRole = switchBody.GetProperty("user").GetProperty("role").GetString();
        switchedRole.Should().Be("admin");

        // Verify via direct DB check that User.TenantId was updated
        var userId = switchBody.GetProperty("user").GetProperty("id").GetString()!;
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        user.Should().NotBeNull();
        user!.TenantId.Should().Be(Guid.Parse(personalTenantId));
    }

    // ── Leave workspace ──

    [Fact]
    public async Task LeaveWorkspace_NonPersonal_Returns204()
    {
        var (token, _) = await RegisterAndInviteToAdminWorkspaceAsync();

        // Leave the admin's workspace (non-personal)
        Client.WithBearerToken(token);
        var response = await Client.PostAsync($"/api/workspaces/{TestData.TenantId}/leave", null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify only personal workspace remains
        var listResponse = await Client.GetAsync("/api/workspaces");
        var json = await listResponse.ReadJsonAsync();
        var workspaces = json.GetProperty("workspaces");
        workspaces.GetArrayLength().Should().Be(1);
        workspaces[0].GetProperty("isPersonal").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task LeaveWorkspace_Personal_Returns403()
    {
        // Register a fresh user
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = "securepassword123",
                name = "Leaver",
            }
        );
        regResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        var personalTenantId = regJson.GetProperty("workspaces")[0].GetProperty("id").GetString()!;

        // Try to leave personal workspace
        Client.WithBearerToken(token);
        var response = await Client.PostAsync($"/api/workspaces/{personalTenantId}/leave", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task LeaveWorkspace_LastAdmin_Returns409()
    {
        // Setup: User A registers, invites User B, then transfers ownership to B.
        // After transfer: User A = editor, User B = admin (sole admin, non-personal).
        // User B tries to leave → LAST_ADMIN (409).

        // Step 1: Register User A (gets personal workspace)
        var emailA = TestData.UniqueEmail();
        var regA = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = emailA,
                password = "securepassword123",
                name = "Owner A",
            }
        );
        regA.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJsonA = await regA.ReadJsonAsync();
        var tokenA = regJsonA.GetProperty("token").GetString()!;
        var personalWsId = regJsonA.GetProperty("workspaces")[0].GetProperty("id").GetString()!;

        // Step 2: User A invites User B as editor → User B accepts
        Client.WithBearerToken(tokenA);
        var emailB = TestData.UniqueEmail();
        var (inviteRes, _) = await Client.PostJsonAsync<JsonElement>(
            "/api/invitations",
            new { email = emailB, role = "editor" }
        );
        inviteRes.EnsureSuccessStatusCode();

        var acceptUrl = TestEmailService.GetInvitationUrl(emailB);
        var rawToken = TestEmailService.ExtractToken(acceptUrl!)!;

        Client.DefaultRequestHeaders.Authorization = null;
        var (acceptRes, acceptBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{rawToken}/accept",
            new { name = "Member B", password = "securepassword123" }
        );
        acceptRes.StatusCode.Should().Be(HttpStatusCode.Created);

        // Get User B's ID and login token for User A's workspace
        var userBId = acceptBody.GetProperty("user").GetProperty("id").GetString()!;

        // Step 3: User A transfers ownership to User B
        Client.WithBearerToken(tokenA);
        var (transferRes, _) = await Client.PostJsonAsync<JsonElement>(
            "/api/users/transfer-ownership",
            new { targetUserId = userBId, confirmation = "TRANSFER" }
        );
        transferRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Now User A = editor, User B = admin (sole admin) in User A's workspace
        // User B's membership in User A's workspace is non-personal

        // Step 4: Login as User B and switch to User A's workspace
        Client.DefaultRequestHeaders.Authorization = null;
        var loginB = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = emailB, password = "securepassword123" }
        );
        loginB.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginBJson = await loginB.ReadJsonAsync();
        var tokenB = loginBJson.GetProperty("token").GetString()!;

        // Switch User B to User A's workspace
        Client.WithBearerToken(tokenB);
        var (switchRes, switchBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/switch-workspace",
            new { tenantId = personalWsId }
        );
        switchRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var tokenBSwitched = switchBody.GetProperty("token").GetString()!;

        // Step 5: User B tries to leave — they're the only admin
        Client.WithBearerToken(tokenBSwitched);
        var response = await Client.PostAsync($"/api/workspaces/{personalWsId}/leave", null);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var errorBody = await response.ReadJsonAsync();
        errorBody.GetProperty("error").GetProperty("code").GetString().Should().Be("LAST_ADMIN");
    }

    // ── Remove user switches to personal workspace ──

    [Fact]
    public async Task RemoveUser_SwitchesToPersonalWorkspace()
    {
        var (userToken, personalTenantId) = await RegisterAndInviteToAdminWorkspaceAsync();

        // Switch user to admin's workspace (so it's their active workspace)
        Client.WithBearerToken(userToken);
        var (switchRes, switchBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/switch-workspace",
            new { tenantId = TestData.TenantId }
        );
        switchRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Get the user's ID from the switch response
        var userId = switchBody.GetProperty("user").GetProperty("id").GetString()!;

        // Admin removes the user from the workspace
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);
        var deleteResponse = await Client.DeleteAsync($"/api/users/{userId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify the user was switched to personal workspace (they can still log in)
        // Use direct DB check since we can't easily re-login with their token
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        user.Should().NotBeNull();
        user!.TenantId.Should().Be(Guid.Parse(personalTenantId));
    }

    // ── Helpers ──

    /// <summary>
    /// Registers a new user, has the admin invite them to the seed workspace,
    /// then accepts the pending invitation. Returns (userToken, personalTenantId).
    /// </summary>
    private async Task<(
        string UserToken,
        string PersonalTenantId
    )> RegisterAndInviteToAdminWorkspaceAsync()
    {
        // Register a new user
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = "securepassword123",
                name = "Multi WS User",
            }
        );
        regResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var regJson = await regResponse.ReadJsonAsync();
        var userToken = regJson.GetProperty("token").GetString()!;
        var personalTenantId = regJson.GetProperty("workspaces")[0].GetProperty("id").GetString()!;

        // Admin invites this user to the seed workspace (creates pending invitation)
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);

        var (inviteRes, inviteBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/invitations",
            new { email, role = "editor" }
        );
        inviteRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var invitationId = inviteBody.GetProperty("id").GetString()!;

        // Accept the pending invitation as the invited user
        Client.WithBearerToken(userToken);
        var (acceptRes, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{invitationId}/respond",
            new { accept = true }
        );
        acceptRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Re-login to get a fresh token reflecting the new membership
        Client.DefaultRequestHeaders.Authorization = null;
        var loginResponse = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email, password = "securepassword123" }
        );
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginJson = await loginResponse.ReadJsonAsync();
        userToken = loginJson.GetProperty("token").GetString()!;

        return (userToken, personalTenantId);
    }
}
