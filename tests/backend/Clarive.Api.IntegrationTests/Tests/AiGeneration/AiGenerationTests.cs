using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.AiGeneration;

[Collection("Integration")]
public class AiGenerationTests : IntegrationTestBase
{
    public AiGenerationTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    // ── Generate ──

    [Fact]
    public async Task Generate_AsEditor_ReturnsSessionWithDraft()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Write a product review", generateSystemMessage = true }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("sessionId").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("draft")
            .GetProperty("title")
            .GetString()
            .Should()
            .Contain("Write a product review");
        body.GetProperty("draft")
            .GetProperty("systemMessage")
            .GetString()
            .Should()
            .NotBeNullOrEmpty();
        // Questions are now structured objects with text + suggestions
        body.GetProperty("questions").GetArrayLength().Should().BeGreaterThan(0);
        body.GetProperty("questions")[0]
            .GetProperty("text")
            .GetString()
            .Should()
            .NotBeNullOrEmpty();
        body.GetProperty("enhancements").GetArrayLength().Should().BeGreaterThan(0);
        // New: evaluation and scoreHistory
        body.GetProperty("evaluation")
            .GetProperty("dimensions")
            .EnumerateObject()
            .Should()
            .HaveCountGreaterThan(0);
        body.GetProperty("scoreHistory").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task Generate_EmptyDescription_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = "   " }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Generate_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = "Test prompt" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Generate_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = "Test prompt" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Generate_WithChainFlag_ReturnsMultiplePrompts()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Build a pipeline", generateChain = true }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("draft").GetProperty("prompts").GetArrayLength().Should().BeGreaterThan(1);
    }

    [Fact]
    public async Task Generate_WithTemplateFlag_ReturnsTemplatePrompt()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Write formal emails", generateTemplate = true }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var prompts = body.GetProperty("draft").GetProperty("prompts");
        prompts.GetArrayLength().Should().Be(1);
        var firstPrompt = prompts.EnumerateArray().First();
        firstPrompt.GetProperty("isTemplate").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Generate_DescriptionTooLong_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate",
            new { description = new string('x', 2001) }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Web Search ──

    [Fact]
    public async Task Generate_WithWebSearchEnabled_ReturnsOk()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Explain quantum computing best practices", enableWebSearch = true }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("sessionId").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("draft").GetProperty("title").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task StatusEndpoint_ReportsWebSearchAvailable()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/auth/login",
            new { email = "jane@clarive.dev", password = "password" }
        );

        // Status endpoint is public
        var statusResponse = await Client.GetAsync("/api/status");
        statusResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var status = await statusResponse.Content.ReadFromJsonAsync<JsonElement>();
        status.GetProperty("webSearchAvailable").GetBoolean().Should().BeTrue();
    }

    // ── Refine ──

    [Fact]
    public async Task Refine_WithValidSession_ReturnsRefinedDraft()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // First generate a session
        var (_, generateBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Email helper" }
        );
        var sessionId = generateBody.GetProperty("sessionId").GetString();

        // Now refine
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/refine",
            new
            {
                sessionId,
                answers = new[] { new { questionIndex = 0, answer = "Keep it formal" } },
                selectedEnhancements = new[] { 0 },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("sessionId").GetString().Should().Be(sessionId);
        body.GetProperty("draft").GetProperty("title").GetString().Should().StartWith("Refined:");
        // Score history should have 2 entries (initial + refine)
        body.GetProperty("scoreHistory").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Refine_InvalidSession_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/refine",
            new { sessionId = Guid.NewGuid() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Refine_OutOfBoundsEnhancementIndices_IgnoresInvalid()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Generate a session first
        var (_, generateBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Test for bounds" }
        );
        var sessionId = generateBody.GetProperty("sessionId").GetString();

        // Refine with out-of-bounds indices (should silently filter them)
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/refine",
            new { sessionId, selectedEnhancements = new[] { -1, 999 } }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("draft").GetProperty("title").GetString().Should().StartWith("Refined:");
    }

    [Fact]
    public async Task Refine_AnswerTooLong_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (_, generateBody) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate",
            new { description = "Length test" }
        );
        var sessionId = generateBody.GetProperty("sessionId").GetString();

        var response = await Client.PostAsJsonAsync(
            "/api/ai/refine",
            new
            {
                sessionId,
                answers = new[] { new { questionIndex = 0, answer = new string('y', 1001) } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Enhance ──

    [Fact]
    public async Task Enhance_ValidEntry_ReturnsEnhancedDraft()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Use seed entry e-001 (Blog Post Generator — published, single prompt)
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/enhance",
            new { entryId = TestData.EntryBlogPostGenerator }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("sessionId").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("draft").GetProperty("prompts").GetArrayLength().Should().BeGreaterThan(0);
        // New: evaluation present
        body.GetProperty("evaluation")
            .GetProperty("dimensions")
            .EnumerateObject()
            .Should()
            .HaveCountGreaterThan(0);
    }

    [Fact]
    public async Task Enhance_InvalidEntry_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/ai/enhance",
            new { entryId = Guid.NewGuid() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Generate System Message ──

    [Fact]
    public async Task GenerateSystemMessage_EntryWithoutSystemMessage_ReturnsMessage()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Use seed entry e-006 (Meeting Notes Formatter — draft, no system message)
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/generate-system-message",
            new { entryId = TestData.EntryMeetingNotes }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("systemMessage").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GenerateSystemMessage_EntryAlreadyHasSystemMessage_Returns409()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Use seed entry e-001 (Blog Post Generator — has system message)
        var response = await Client.PostAsJsonAsync(
            "/api/ai/generate-system-message",
            new { entryId = TestData.EntryBlogPostGenerator }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Decompose ──

    [Fact]
    public async Task Decompose_SinglePromptEntry_ReturnsChainSteps()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Use seed entry e-001 (Blog Post Generator — single prompt)
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/ai/decompose",
            new { entryId = TestData.EntryBlogPostGenerator }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("prompts").GetArrayLength().Should().BeGreaterThan(1);
    }

    [Fact]
    public async Task Decompose_MultiPromptEntry_Returns409()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Use seed entry e-002 (Code Review Pipeline — 3 prompts, already a chain)
        var response = await Client.PostAsJsonAsync(
            "/api/ai/decompose",
            new { entryId = TestData.EntryCodeReviewPipeline }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
