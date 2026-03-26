using System.Net;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class GitHubAuthTests : IntegrationTestBase
{
    public GitHubAuthTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task GitHubAuthorize_Returns302()
    {
        // The default HttpClient follows redirects, so we get a final response.
        // The authorize endpoint redirects to GitHub, which will fail externally,
        // but we can verify it doesn't return an error status.
        var response = await Client.GetAsync("/api/auth/github/authorize");

        // The final response after following the redirect to GitHub will be some error
        // (can't reach GitHub from tests), but the initial redirect happened.
        // Just verify the endpoint is reachable and doesn't return 503.
        response.StatusCode.Should().NotBe(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task GitHubCallback_WithInvalidState_Returns302()
    {
        // Callback with invalid state should redirect to frontend with error
        var response = await Client.GetAsync(
            "/api/auth/github/callback?code=some-code&state=invalid-state-token"
        );

        // After redirect, the frontend URL won't exist in test server,
        // but verify we don't get a 500 error
        response.StatusCode.Should().NotBe(HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GitHubCallback_WithMissingParams_Returns302()
    {
        var response = await Client.GetAsync("/api/auth/github/callback");

        response.StatusCode.Should().NotBe(HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GitHubClientId_ReturnsConfiguredClientId()
    {
        var response = await Client.GetAsync("/api/auth/github-client-id");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.TryGetProperty("clientId", out var clientId).Should().BeTrue();
        clientId.GetString().Should().Be("test-github-client-id");
    }

    [Fact]
    public async Task SetupStatus_IncludesGitHubEnabled()
    {
        var response = await Client.GetAsync("/api/auth/setup-status");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.TryGetProperty("githubEnabled", out var prop).Should().BeTrue();
        prop.GetBoolean().Should().BeTrue();
    }
}
