using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthMeProfileTests : IntegrationTestBase
{
    public AuthMeProfileTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task GetMe_WithValidToken_ReturnsCurrentUser()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("email").GetString().Should().Be(TestData.AdminEmail);
        json.GetProperty("name").GetString().Should().Be("Admin User");
        json.GetProperty("role").GetString().Should().Be("admin");
    }

    [Fact]
    public async Task GetMe_NoToken_Returns401()
    {
        var response = await Client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateProfile_ChangeName_Returns200()
    {
        // Register a fresh user so we don't mutate seed data
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Original Name"
        });
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;

        Client.WithBearerToken(token);

        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/auth/profile", new
        {
            name = "Updated Name"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("name").GetString().Should().Be("Updated Name");
        json.GetProperty("email").GetString().Should().Be(email);
    }

    [Fact]
    public async Task UpdateProfile_ChangePasswordWithoutCurrent_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<object>("/api/auth/profile", new
        {
            newPassword = "newSecurePass123"
            // missing currentPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
