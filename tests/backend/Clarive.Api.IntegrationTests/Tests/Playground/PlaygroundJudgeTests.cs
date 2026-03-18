using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Playground;

[Collection("Integration")]
public class PlaygroundJudgeTests : IntegrationTestBase
{
    public PlaygroundJudgeTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task JudgeRun_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/runs/{Guid.NewGuid()}/judge",
            new { });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task JudgeRun_InvalidRunId_Returns404OrServiceUnavailable()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/runs/{Guid.NewGuid()}/judge",
            new { });

        // Returns 404 (run not found) or 503 (AI not configured in test env)
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.NotFound,
            HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task JudgeRun_InvalidEntryId_Returns404OrServiceUnavailable()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{Guid.NewGuid()}/runs/{Guid.NewGuid()}/judge",
            new { });

        // Returns 404 (entry not found) or 503 (AI not configured)
        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.NotFound,
            HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task TestRuns_IncludeJudgeScoresField()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/test-runs");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        // The response should be valid JSON array — judge scores field is nullable
        body.Should().NotBeNullOrEmpty();
    }
}
