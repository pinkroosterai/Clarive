using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Clarive.Api.Data;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Invitations;

[Collection("Integration")]
public class ExistingUserInviteTests : IntegrationTestBase
{
    public ExistingUserInviteTests(IntegrationTestFixture fixture) : base(fixture) { }

    // ── Helpers ──

    /// <summary>
    /// Registers a new user and returns (email, token).
    /// </summary>
    private async Task<(string Email, string Token)> RegisterNewUserAsync()
    {
        var email = TestData.UniqueEmail();
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/register",
            new { email, password = "securepassword123", name = "Test User" });
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var token = body.GetProperty("token").GetString()!;
        return (email, token);
    }

    /// <summary>
    /// Admin invites the given email and returns the invitation ID.
    /// Leaves the client authenticated as admin.
    /// </summary>
    private async Task<string> InviteExistingUserAsync(string email, string role = "editor")
    {
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);

        var (response, body) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("status").GetString().Should().Be("pending");
        return body.GetProperty("id").GetString()!;
    }

    /// <summary>
    /// Directly modifies the invitation's ExpiresAt to a past date via DB access.
    /// </summary>
    private async Task ExpireInvitationAsync(string invitationId)
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var id = Guid.Parse(invitationId);
        var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.Id == id);
        invitation.Should().NotBeNull();
        invitation!.ExpiresAt = DateTime.UtcNow.AddDays(-1);
        await db.SaveChangesAsync();
    }

    // ── Tests: Create ──

    [Fact]
    public async Task InviteExistingUser_CreatesPendingInvitation_NotMembership()
    {
        var (email, _) = await RegisterNewUserAsync();
        var invitationId = await InviteExistingUserAsync(email);

        // Verify no membership was created in admin's workspace
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var membership = await db.TenantMemberships
            .FirstOrDefaultAsync(m => m.TenantId == TestData.TenantId
                && db.Users.Any(u => u.Id == m.UserId && u.Email == email));
        membership.Should().BeNull("existing user should NOT be auto-added as member");
    }

    [Fact]
    public async Task InviteExistingUser_DuplicateInvite_Returns409()
    {
        var (email, _) = await RegisterNewUserAsync();
        await InviteExistingUserAsync(email);

        // Second invite for same email should fail
        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "viewer"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.ReadJsonAsync();
        body.GetProperty("error").GetProperty("code").GetString().Should().Be("INVITATION_EXISTS");
    }

    // ── Tests: Get Pending ──

    [Fact]
    public async Task GetPending_ReturnsInvitationsForUser()
    {
        var (email, userToken) = await RegisterNewUserAsync();
        await InviteExistingUserAsync(email);

        // Authenticate as the invited user
        Client.WithBearerToken(userToken);
        var response = await Client.GetAsync("/api/invitations/pending");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        var invitations = json.GetProperty("invitations");
        invitations.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        var invite = invitations.EnumerateArray().First();
        invite.GetProperty("role").GetString().Should().Be("editor");
        invite.TryGetProperty("workspaceName", out _).Should().BeTrue();
        invite.TryGetProperty("invitedBy", out _).Should().BeTrue();
        invite.TryGetProperty("expiresAt", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GetPending_NoInvitations_ReturnsEmptyArray()
    {
        var (_, userToken) = await RegisterNewUserAsync();

        Client.WithBearerToken(userToken);
        var response = await Client.GetAsync("/api/invitations/pending");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("invitations").GetArrayLength().Should().Be(0);
    }

    // ── Tests: Pending Count ──

    [Fact]
    public async Task GetPendingCount_ReturnsCorrectCount()
    {
        var (email, userToken) = await RegisterNewUserAsync();
        await InviteExistingUserAsync(email);

        Client.WithBearerToken(userToken);
        var response = await Client.GetAsync("/api/invitations/pending/count");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("count").GetInt32().Should().BeGreaterOrEqualTo(1);
    }

    // ── Tests: Accept ──

    [Fact]
    public async Task AcceptInvitation_CreatesMembership_ReturnsWorkspace()
    {
        var (email, userToken) = await RegisterNewUserAsync();
        var invitationId = await InviteExistingUserAsync(email);

        Client.WithBearerToken(userToken);
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{invitationId}/respond",
            new { accept = true });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.TryGetProperty("message", out _).Should().BeTrue();
        body.TryGetProperty("workspace", out var workspace).Should().BeTrue();
        workspace.GetProperty("role").GetString().Should().Be("editor");
        workspace.GetProperty("isPersonal").GetBoolean().Should().BeFalse();

        // Verify membership was created
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var membership = await db.TenantMemberships
            .FirstOrDefaultAsync(m => m.TenantId == TestData.TenantId
                && db.Users.Any(u => u.Id == m.UserId && u.Email == email));
        membership.Should().NotBeNull("membership should be created after accepting");

        // Verify invitation was deleted
        var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.Id == Guid.Parse(invitationId));
        invitation.Should().BeNull("invitation should be deleted after accepting");
    }

    // ── Tests: Decline ──

    [Fact]
    public async Task DeclineInvitation_DeletesInvitation_NoMembership()
    {
        var (email, userToken) = await RegisterNewUserAsync();
        var invitationId = await InviteExistingUserAsync(email);

        Client.WithBearerToken(userToken);
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{invitationId}/respond",
            new { accept = false });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("message").GetString().Should().Contain("declined");

        // Verify NO membership was created
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var membership = await db.TenantMemberships
            .FirstOrDefaultAsync(m => m.TenantId == TestData.TenantId
                && db.Users.Any(u => u.Id == m.UserId && u.Email == email));
        membership.Should().BeNull("no membership should exist after declining");

        // Verify pending count is now 0
        var pendingResponse = await Client.GetAsync("/api/invitations/pending/count");
        var countJson = await pendingResponse.ReadJsonAsync();
        countJson.GetProperty("count").GetInt32().Should().Be(0);
    }

    // ── Tests: Authorization ──

    [Fact]
    public async Task RespondToOtherUsersInvitation_Returns404()
    {
        var (email, _) = await RegisterNewUserAsync();
        var invitationId = await InviteExistingUserAsync(email);

        // Register a different user and try to respond to the first user's invitation
        var (_, otherToken) = await RegisterNewUserAsync();
        Client.WithBearerToken(otherToken);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{invitationId}/respond",
            new { accept = true });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RespondToExpiredInvitation_Returns404()
    {
        var (email, userToken) = await RegisterNewUserAsync();
        var invitationId = await InviteExistingUserAsync(email);

        // Expire the invitation
        await ExpireInvitationAsync(invitationId);

        Client.WithBearerToken(userToken);
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{invitationId}/respond",
            new { accept = true });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RespondToNonExistentInvitation_Returns404()
    {
        var (_, userToken) = await RegisterNewUserAsync();
        Client.WithBearerToken(userToken);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{Guid.NewGuid()}/respond",
            new { accept = true });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPending_Unauthenticated_Returns401()
    {
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync("/api/invitations/pending");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
