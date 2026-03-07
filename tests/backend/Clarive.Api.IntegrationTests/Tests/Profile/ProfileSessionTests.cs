using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Profile;

[Collection("Integration")]
public class ProfileSessionTests : IntegrationTestBase
{
    public ProfileSessionTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task GetSessions_WithToken_ReturnsSessions()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/profile/sessions");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var sessions = await response.ReadJsonAsync();
        sessions.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        var session = sessions[0];
        session.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        session.TryGetProperty("browser", out _).Should().BeTrue();
        session.TryGetProperty("os", out _).Should().BeTrue();
        session.TryGetProperty("createdAt", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GetSessions_NoToken_Returns401()
    {
        var response = await Client.GetAsync("/api/profile/sessions");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RevokeSession_NonExistent_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync($"/api/profile/sessions/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteAvatar_WhenNoAvatar_Returns204()
    {
        // Register fresh user with no avatar
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securepassword123",
            name = "No Avatar User"
        });
        regResponse.EnsureSuccessStatusCode();
        var regJson = await regResponse.ReadJsonAsync();
        var freshToken = regJson.GetProperty("token").GetString()!;

        Client.WithBearerToken(freshToken);

        var response = await Client.DeleteAsync("/api/profile/avatar");
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
