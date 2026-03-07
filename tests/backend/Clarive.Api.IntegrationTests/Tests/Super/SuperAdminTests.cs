using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class SuperAdminTests : IntegrationTestBase
{
    public SuperAdminTests(IntegrationTestFixture fixture) : base(fixture) { }

    // ── Stats ──

    [Fact]
    public async Task GetStats_AsSuperUser_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();

        json.GetProperty("totalUsers").GetInt32().Should().BeGreaterOrEqualTo(3);
        json.GetProperty("totalWorkspaces").GetInt32().Should().BeGreaterOrEqualTo(1);
        json.GetProperty("totalEntries").GetInt32().Should().BeGreaterOrEqualTo(1);
    }

    [Fact]
    public async Task GetStats_AsNonSuperUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/stats");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Maintenance Mode ──

    [Fact]
    public async Task GetMaintenance_AsSuperUser_ReturnsStatus()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/maintenance");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.TryGetProperty("enabled", out _).Should().BeTrue();
    }

    [Fact]
    public async Task SetMaintenance_EnableAndDisable_RoundTrips()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Enable
        var (enableResponse, enableBody) = await Client.PostJsonAsync<JsonElement>("/api/super/maintenance", new
        {
            enabled = true
        });
        enableResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        enableBody.GetProperty("enabled").GetBoolean().Should().BeTrue();

        // Disable (cleanup)
        var (disableResponse, disableBody) = await Client.PostJsonAsync<JsonElement>("/api/super/maintenance", new
        {
            enabled = false
        });
        disableResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        disableBody.GetProperty("enabled").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task SetMaintenance_AsNonSuperUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/super/maintenance", new
        {
            enabled = true
        });
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Users List ──

    [Fact]
    public async Task GetUsers_AsSuperUser_ReturnsPaginatedList()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/users?page=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();

        json.GetProperty("total").GetInt32().Should().BeGreaterOrEqualTo(3);
        var users = json.GetProperty("users").EnumerateArray().ToList();
        users.Should().NotBeEmpty();

        var user = users[0];
        user.GetProperty("email").GetString().Should().NotBeNullOrEmpty();
        user.GetProperty("name").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetUsers_WithSearch_FiltersResults()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/users?search=admin");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        var users = json.GetProperty("users").EnumerateArray().ToList();
        users.Should().NotBeEmpty();
        users.Should().AllSatisfy(u =>
        {
            var email = u.GetProperty("email").GetString()!;
            var name = u.GetProperty("name").GetString()!;
            (email.Contains("admin", StringComparison.OrdinalIgnoreCase)
             || name.Contains("admin", StringComparison.OrdinalIgnoreCase))
                .Should().BeTrue();
        });
    }

    // ── Delete User ──

    [Fact]
    public async Task DeleteUser_SoftDelete_SchedulesDeletion()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);

        // Register a throwaway user
        var email = TestData.UniqueEmail();
        await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "securepassword123", name = "To Delete"
        });

        // Find user ID from super users list
        Client.WithBearerToken(token);
        var listResponse = await Client.GetAsync($"/api/super/users?search={Uri.EscapeDataString(email)}");
        var listJson = await listResponse.ReadJsonAsync();
        var userId = listJson.GetProperty("users")[0].GetProperty("id").GetString();

        // Soft delete
        var deleteResponse = await Client.DeleteAsync($"/api/super/users/{userId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteUser_Self_Returns409()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync($"/api/super/users/{TestData.AdminUserId}");
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task DeleteUser_NonExistent_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync($"/api/super/users/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Reset Password ──

    [Fact]
    public async Task ResetPassword_AsSuperUser_ReturnsNewPassword()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);

        // Register a throwaway user
        var email = TestData.UniqueEmail();
        await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "securepassword123", name = "PW Reset Target"
        });

        // Find user ID
        Client.WithBearerToken(token);
        var listResponse = await Client.GetAsync($"/api/super/users?search={Uri.EscapeDataString(email)}");
        var listJson = await listResponse.ReadJsonAsync();
        var userId = listJson.GetProperty("users")[0].GetProperty("id").GetString();

        // Reset password
        var (resetResponse, resetBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/super/users/{userId}/reset-password", new { });

        resetResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        resetBody.GetProperty("newPassword").GetString().Should().HaveLength(16);
    }

    [Fact]
    public async Task ResetPassword_NonExistent_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/super/users/{Guid.NewGuid()}/reset-password", new { });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
