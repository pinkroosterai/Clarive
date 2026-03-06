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
public class InvitationTests : IntegrationTestBase
{
    public InvitationTests(IntegrationTestFixture fixture) : base(fixture) { }

    // ── Create ──

    [Fact]
    public async Task CreateInvitation_AsAdmin_Returns201()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var email = TestData.UniqueEmail();
        var (response, body) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "editor"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("email").GetString().Should().Be(email);
        body.GetProperty("role").GetString().Should().Be("editor");
        body.TryGetProperty("id", out _).Should().BeTrue();
        body.TryGetProperty("expiresAt", out _).Should().BeTrue();
    }

    [Fact]
    public async Task CreateInvitation_AsEditor_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email = TestData.UniqueEmail(),
            role = "viewer"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateInvitation_ExistingMember_Returns409()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Try to invite a seed user who is already a member of this workspace
        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email = TestData.EditorEmail,
            role = "viewer"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var errorBody = await response.ReadJsonAsync();
        errorBody.GetProperty("error").GetProperty("code").GetString().Should().Be("ALREADY_MEMBER");
    }

    [Fact]
    public async Task CreateInvitation_ExistingUser_NotMember_CreatesPendingInvitation()
    {
        // Register a new user (gets their own personal workspace)
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsync(
            "/api/auth/register",
            JsonContent.Create(new { email, password = "securepassword123", name = "External User" }));
        regResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Admin invites this existing user to the admin's workspace
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);

        var (response, body) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "editor"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("status").GetString().Should().Be("pending");
        body.GetProperty("role").GetString().Should().Be("editor");
    }

    [Fact]
    public async Task CreateInvitation_DuplicateActiveInvite_Returns409()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var email = TestData.UniqueEmail();

        // First invitation should succeed
        var (first, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "editor"
        });
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        // Second invitation for the same email should fail
        var (second, secondBody) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "viewer"
        });
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var secondError = await second.ReadJsonAsync();
        secondError.GetProperty("error").GetProperty("code").GetString().Should().Be("INVITATION_EXISTS");
    }

    [Fact]
    public async Task CreateInvitation_AdminRole_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email = TestData.UniqueEmail(),
            role = "admin"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Validate ──

    [Fact]
    public async Task ValidateToken_Valid_Returns200()
    {
        var (_, rawToken) = await CreateInvitationAndGetTokenAsync("editor");

        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/invitations/{rawToken}/validate");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("role").GetString().Should().Be("editor");
        json.TryGetProperty("email", out _).Should().BeTrue();
        json.TryGetProperty("workspaceName", out _).Should().BeTrue();
    }

    [Fact]
    public async Task ValidateToken_Invalid_Returns404()
    {
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync("/api/invitations/inv_totally-invalid-token/validate");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ValidateToken_Expired_Returns404()
    {
        var (email, rawToken) = await CreateInvitationAndGetTokenAsync("viewer");

        // Expire the invitation via direct DB manipulation
        await ExpireInvitationByEmailAsync(email);

        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/invitations/{rawToken}/validate");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Accept ──

    [Fact]
    public async Task AcceptInvitation_Valid_Returns201WithWorkspaces()
    {
        var (email, rawToken) = await CreateInvitationAndGetTokenAsync("editor");

        Client.DefaultRequestHeaders.Authorization = null;
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{rawToken}/accept",
            new { name = "New Team Member", password = "securepassword123" });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.TryGetProperty("token", out _).Should().BeTrue();
        body.TryGetProperty("refreshToken", out _).Should().BeTrue();
        body.GetProperty("user").GetProperty("email").GetString().Should().Be(email);
        body.GetProperty("user").GetProperty("role").GetString().Should().Be("editor");
        body.GetProperty("user").GetProperty("emailVerified").GetBoolean().Should().BeTrue();

        // Verify workspaces: should have personal + invited workspace
        body.TryGetProperty("workspaces", out var workspaces).Should().BeTrue();
        workspaces.GetArrayLength().Should().Be(2);

        var personalWs = workspaces.EnumerateArray().FirstOrDefault(w => w.GetProperty("isPersonal").GetBoolean());
        personalWs.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        personalWs.GetProperty("role").GetString().Should().Be("admin");

        var invitedWs = workspaces.EnumerateArray().FirstOrDefault(w => !w.GetProperty("isPersonal").GetBoolean());
        invitedWs.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        invitedWs.GetProperty("role").GetString().Should().Be("editor");
    }

    [Fact]
    public async Task AcceptInvitation_WeakPassword_Returns422()
    {
        var (_, rawToken) = await CreateInvitationAndGetTokenAsync("viewer");

        Client.DefaultRequestHeaders.Authorization = null;
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{rawToken}/accept",
            new { name = "Test User", password = "short" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task AcceptInvitation_Expired_Returns404()
    {
        var (email, rawToken) = await CreateInvitationAndGetTokenAsync("editor");

        // Expire the invitation
        await ExpireInvitationByEmailAsync(email);

        Client.DefaultRequestHeaders.Authorization = null;
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{rawToken}/accept",
            new { name = "Too Late", password = "securepassword123" });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Resend ──

    [Fact]
    public async Task ResendInvitation_AsAdmin_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var email = TestData.UniqueEmail();
        var (createRes, createBody) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "editor"
        });
        createRes.EnsureSuccessStatusCode();
        var invitationId = createBody.GetProperty("id").GetString();
        var originalExpiry = createBody.GetProperty("expiresAt").GetString();

        // Small delay to ensure new expiresAt is measurably different
        await Task.Delay(100);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{invitationId}/resend", new { });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("email").GetString().Should().Be(email);

        // ExpiresAt should be updated (new token = new expiry)
        var newExpiry = body.GetProperty("expiresAt").GetString();
        newExpiry.Should().NotBe(originalExpiry);
    }

    // ── Revoke ──

    [Fact]
    public async Task RevokeInvitation_AsAdmin_Returns204()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var email = TestData.UniqueEmail();
        var (createRes, createBody) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "viewer"
        });
        createRes.EnsureSuccessStatusCode();
        var invitationId = createBody.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/invitations/{invitationId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task AcceptInvitation_AfterRevoke_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var email = TestData.UniqueEmail();
        var (createRes, createBody) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role = "editor"
        });
        createRes.EnsureSuccessStatusCode();

        // Get the raw token before revoking
        var acceptUrl = TestEmailService.GetInvitationUrl(email);
        var rawToken = TestEmailService.ExtractToken(acceptUrl!);

        // Revoke
        var invitationId = createBody.GetProperty("id").GetString();
        var revokeRes = await Client.DeleteAsync($"/api/invitations/{invitationId}");
        revokeRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Try to accept the revoked invitation
        Client.DefaultRequestHeaders.Authorization = null;
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{rawToken}/accept",
            new { name = "Should Fail", password = "securepassword123" });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Helpers ──

    /// <summary>
    /// Creates an invitation as admin and returns (email, rawToken).
    /// </summary>
    private async Task<(string Email, string RawToken)> CreateInvitationAndGetTokenAsync(string role)
    {
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);

        var email = TestData.UniqueEmail();
        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role
        });
        response.EnsureSuccessStatusCode();

        var acceptUrl = TestEmailService.GetInvitationUrl(email);
        acceptUrl.Should().NotBeNull("TestEmailService should have captured the invitation URL");
        var rawToken = TestEmailService.ExtractToken(acceptUrl!)!;

        return (email, rawToken);
    }

    /// <summary>
    /// Directly modifies the invitation's ExpiresAt to a past date via DB access.
    /// </summary>
    private async Task ExpireInvitationByEmailAsync(string email)
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var invitation = await db.Invitations
            .FirstOrDefaultAsync(i => i.Email == email.Trim().ToLowerInvariant());
        invitation.Should().NotBeNull();
        invitation!.ExpiresAt = DateTime.UtcNow.AddDays(-1);
        await db.SaveChangesAsync();
    }
}
