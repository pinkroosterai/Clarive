using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.AiGeneration;

[Collection("Integration")]
public class AiEvaluateTests : IntegrationTestBase
{
    public AiEvaluateTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Evaluate_ValidPrompts_ReturnsEvaluationWith4Dimensions()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/evaluate",
            new
            {
                systemMessage = "You are a helpful assistant.",
                prompts = new[]
                {
                    new { content = "Write a blog post about AI trends.", sortOrder = 0 },
                },
                description = "Blog post generation",
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dimensions = body.GetProperty("dimensions");
        dimensions.EnumerateObject().Should().HaveCount(4);
        dimensions.GetProperty("Clarity").GetProperty("score").GetInt32().Should().BeInRange(0, 10);
        dimensions.GetProperty("Clarity").GetProperty("feedback").GetString().Should().NotBeEmpty();
        dimensions.GetProperty("Effectiveness").GetProperty("score").GetInt32().Should().BeInRange(0, 10);
        dimensions.GetProperty("Completeness").GetProperty("score").GetInt32().Should().BeInRange(0, 10);
        dimensions.GetProperty("Faithfulness").GetProperty("score").GetInt32().Should().BeInRange(0, 10);
    }

    [Fact]
    public async Task Evaluate_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/ai/evaluate",
            new
            {
                prompts = new[] { new { content = "Test prompt", sortOrder = 0 } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Evaluate_EmptyPrompts_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/evaluate",
            new
            {
                prompts = Array.Empty<object>(),
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Evaluate_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/evaluate",
            new
            {
                prompts = new[] { new { content = "Test prompt", sortOrder = 0 } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Evaluate_NoSystemMessage_StillWorks()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/evaluate",
            new
            {
                prompts = new[]
                {
                    new { content = "Summarize this article.", sortOrder = 0 },
                    new { content = "Now translate to French.", sortOrder = 1 },
                },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("dimensions").EnumerateObject().Should().HaveCount(4);
    }
}
