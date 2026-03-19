using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthRefreshTests : IntegrationTestBase
{
    public AuthRefreshTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Refresh_WithValidToken_ReturnsNewTokenPair()
    {
        // Login to get a refresh token
        var loginResponse = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = TestData.AdminEmail, password = TestData.SeedPassword }
        );
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var loginJson = await loginResponse.ReadJsonAsync();
        var refreshToken = loginJson.GetProperty("refreshToken").GetString();
        refreshToken.Should().NotBeNullOrWhiteSpace();

        // Use refresh token to get new pair
        var refreshResponse = await Client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken }
        );

        refreshResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var refreshJson = await refreshResponse.ReadJsonAsync();
        refreshJson.GetProperty("token").GetString().Should().NotBeNullOrWhiteSpace();
        refreshJson.GetProperty("refreshToken").GetString().Should().NotBeNullOrWhiteSpace();
        refreshJson
            .GetProperty("user")
            .GetProperty("email")
            .GetString()
            .Should()
            .Be(TestData.AdminEmail);

        // New refresh token should be different from old one
        refreshJson.GetProperty("refreshToken").GetString().Should().NotBe(refreshToken);
    }

    [Fact]
    public async Task Refresh_RotatedTokenInvalidatesOld()
    {
        // Login to get a refresh token
        var loginResponse = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = TestData.EditorEmail, password = TestData.SeedPassword }
        );
        var loginJson = await loginResponse.ReadJsonAsync();
        var originalRefresh = loginJson.GetProperty("refreshToken").GetString();

        // Rotate: use the token once
        var rotateResponse = await Client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = originalRefresh }
        );
        rotateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Try to use the old (now revoked) token again
        var replayResponse = await Client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = originalRefresh }
        );
        replayResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_WithInvalidToken_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = "rt_invalid_token_that_does_not_exist" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_WithEmptyToken_Returns422()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = "" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
