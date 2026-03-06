using System.Net;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Users;

[Collection("Integration")]
public class UserManagementTests : IntegrationTestBase
{
    public UserManagementTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ListUsers_AsAdmin_ReturnsSeedUsersWithStatus()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.ValueKind.Should().Be(JsonValueKind.Object);
        json.GetProperty("items").GetArrayLength().Should().BeGreaterOrEqualTo(3);
        json.GetProperty("total").GetInt32().Should().BeGreaterOrEqualTo(3);

        // All seed users should have a status field
        var items = json.GetProperty("items");
        foreach (var item in items.EnumerateArray())
        {
            item.GetProperty("status").GetString().Should().BeOneOf("active", "pending");
        }
    }

    [Fact]
    public async Task ChangeRole_AsAdmin_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a user via the invitation flow
        var userId = await CreateInvitedUserAsync("editor");

        var (response, body) = await Client.PatchJsonAsync<JsonElement>(
            $"/api/users/{userId}/role",
            new { role = "viewer" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("role").GetString().Should().Be("viewer");
    }

    [Fact]
    public async Task ChangeOwnRole_Returns409()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<JsonElement>(
            $"/api/users/{TestData.AdminUserId}/role",
            new { role = "editor" });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task DeleteUser_AsAdmin_Returns204()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a user via the invitation flow
        var userId = await CreateInvitedUserAsync("viewer");

        var response = await Client.DeleteAsync($"/api/users/{userId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    /// <summary>
    /// Creates a user by sending an invitation (as admin) and accepting it.
    /// Returns the new user's ID.
    /// </summary>
    private async Task<string> CreateInvitedUserAsync(string role)
    {
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);

        var email = TestData.UniqueEmail();
        var (createRes, _) = await Client.PostJsonAsync<JsonElement>("/api/invitations", new
        {
            email,
            role
        });
        createRes.EnsureSuccessStatusCode();

        // Extract raw token from TestEmailService
        var acceptUrl = TestEmailService.GetInvitationUrl(email);
        acceptUrl.Should().NotBeNull("invitation email should have been captured");
        var rawToken = TestEmailService.ExtractToken(acceptUrl!);
        rawToken.Should().NotBeNull();

        // Accept the invitation (anonymous)
        Client.DefaultRequestHeaders.Authorization = null;
        var (acceptRes, acceptBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/invitations/{rawToken}/accept",
            new { name = "Test User", password = "testpassword123" });
        acceptRes.StatusCode.Should().Be(HttpStatusCode.Created);

        // Re-authenticate as admin for the caller
        Client.WithBearerToken(adminToken);

        return acceptBody.GetProperty("user").GetProperty("id").GetString()!;
    }
}
