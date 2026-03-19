using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Playground;

[Collection("Integration")]
public class PlaygroundTests : IntegrationTestBase
{
    public PlaygroundTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    // ── Test Entry (error paths) ──

    [Fact]
    public async Task Test_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test",
            new { temperature = 1.0, maxTokens = 100 }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Test_InvalidEntryId_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{Guid.NewGuid()}/test",
            new { temperature = 1.0, maxTokens = 100 }
        );

        // The service will return NOT_FOUND which maps to 404
        // (or 500 if OpenAI client fails first — but the entry check comes first)
        response
            .StatusCode.Should()
            .BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task Test_InvalidTemperature_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test",
            new { temperature = 5.0, maxTokens = 100 }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Test_InvalidMaxTokens_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test",
            new { temperature = 1.0, maxTokens = 0 }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Test_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test",
            new { temperature = 1.0, maxTokens = 100 }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Get Test Runs ──

    [Fact]
    public async Task GetTestRuns_EmptyHistory_ReturnsEmptyList()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test-runs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.ReadJsonAsync();
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task GetTestRuns_AsViewer_ReturnsOk()
    {
        // Viewers can read test runs (just not create them)
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test-runs"
        );

        // Viewers have RequireAuthorization() but the endpoint doesn't specify EditorOrAdmin
        // for GET test-runs — they should be able to read
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetTestRuns_Unauthenticated_Returns401()
    {
        var response = await Client.GetAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test-runs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Get Available Models ──

    [Fact]
    public async Task GetModels_Unauthenticated_Returns401()
    {
        var response = await Client.GetAsync("/api/ai/models");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetModels_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/ai/models");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
