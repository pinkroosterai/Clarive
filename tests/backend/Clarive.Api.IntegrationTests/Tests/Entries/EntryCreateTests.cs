using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryCreateTests : IntegrationTestBase
{
    public EntryCreateTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Create_AsEditor_Returns201WithDraftV1()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var title = TestData.UniqueEntryTitle();
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title,
                systemMessage = "You are a helpful assistant.",
                prompts = new[] { new { content = "Hello world", isTemplate = false } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("title").GetString().Should().Be(title);
        body.GetProperty("version").GetInt32().Should().Be(1);
        body.GetProperty("versionState").GetString().Should().Be("draft");
        body.GetProperty("systemMessage").GetString().Should().Be("You are a helpful assistant.");
    }

    [Fact]
    public async Task Create_InFolder_SetsCorrectFolderId()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var title = TestData.UniqueEntryTitle();
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title,
                prompts = new[] { new { content = "Test prompt" } },
                folderId = TestData.FolderDataAnalysis,
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("folderId")
            .GetString()
            .Should()
            .Be(TestData.FolderDataAnalysis.ToString());
    }

    [Fact]
    public async Task Create_WithTemplateFields_DetectsFields()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Write about {{topic}} for {{audience}}" } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var prompts = body.GetProperty("prompts");
        var firstPrompt = prompts.EnumerateArray().First();
        firstPrompt.GetProperty("isTemplate").GetBoolean().Should().BeTrue();

        var fields = firstPrompt.GetProperty("templateFields").EnumerateArray().ToList();
        fields.Should().HaveCountGreaterThanOrEqualTo(2);
        fields
            .Select(f => f.GetProperty("name").GetString())
            .Should()
            .Contain("topic")
            .And.Contain("audience");
    }

    [Fact]
    public async Task Create_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Test" } },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Create_EmptyTitle_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/entries",
            new { title = "   ", prompts = new[] { new { content = "Test" } } }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
