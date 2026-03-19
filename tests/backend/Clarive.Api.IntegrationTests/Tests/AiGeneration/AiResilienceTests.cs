using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Clarive.Api.Services.Agents;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.AiGeneration;

[Collection("Integration")]
public class AiResilienceTests : IntegrationTestBase
{
    public AiResilienceTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Generate_RateLimitedError_Returns429WithRetryAfter()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        MockPromptOrchestrator.ThrowAiProviderErrorCategory = AiProviderErrorCategory.RateLimited;

        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = "Test rate limit" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = body.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("AI_RATE_LIMITED");
        error.GetProperty("details").GetProperty("retryAfterSeconds").GetInt32().Should().Be(30);
        error.GetProperty("details").GetProperty("attemptsMade").GetInt32().Should().Be(4);
        error.GetProperty("details").GetProperty("providerName").GetString().Should().Be("MockProvider");
    }

    [Fact]
    public async Task Generate_UnavailableError_Returns503()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        MockPromptOrchestrator.ThrowAiProviderErrorCategory = AiProviderErrorCategory.Unavailable;

        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = "Test unavailable" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = body.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("AI_UNAVAILABLE");
        error.GetProperty("details").GetProperty("retryAfterSeconds").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Generate_TimeoutError_Returns504()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        MockPromptOrchestrator.ThrowAiProviderErrorCategory = AiProviderErrorCategory.Timeout;

        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = "Test timeout" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.GatewayTimeout);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = body.GetProperty("error");
        error.GetProperty("code").GetString().Should().Be("AI_TIMEOUT");
    }
}
