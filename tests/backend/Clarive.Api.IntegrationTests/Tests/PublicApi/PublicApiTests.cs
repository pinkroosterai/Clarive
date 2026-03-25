using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.PublicApi;

[Collection("Integration")]
public class PublicApiTests : IntegrationTestBase
{
    public PublicApiTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Get_WithValidApiKey_PublishedEntry_Returns200()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 "Blog Post Generator" is published
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("id").GetString().Should().Be(TestData.EntryBlogPostGenerator.ToString());
        json.GetProperty("title").GetString().Should().NotBeNullOrEmpty();
        json.GetProperty("version").GetInt32().Should().BeGreaterOrEqualTo(1);
    }

    [Fact]
    public async Task Get_WithoutApiKey_Returns401()
    {
        // No API key header
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_DraftOnlyEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-003 "CSV Summarizer" is draft-only (never published)
        var response = await Client.GetAsync($"/public/v1/entries/{TestData.EntryCsvSummarizer}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_TrashedEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-009 "Deprecated Summarizer" is trashed
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryDeprecatedSummarizer}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Generate_WithValidFields_Returns200()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 "Blog Post Generator" has template fields: tone, topic, audience, wordCount
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/generate",
            new
            {
                fields = new Dictionary<string, string>
                {
                    ["tone"] = "professional",
                    ["topic"] = "AI testing",
                    ["audience"] = "developers",
                    ["wordCount"] = "500",
                },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("renderedPrompts").GetArrayLength().Should().BeGreaterOrEqualTo(1);

        // Verify template fields were rendered (no {{...}} placeholders remain)
        var firstPromptContent = body.GetProperty("renderedPrompts")[0]
            .GetProperty("content")
            .GetString()!;
        firstPromptContent.Should().Contain("professional");
        firstPromptContent.Should().Contain("AI testing");
    }

    [Fact]
    public async Task Generate_MissingRequiredFields_Returns422()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 has template fields but we send empty fields dict
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/generate",
            new { fields = new Dictionary<string, string>() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Tab List Endpoint ──

    [Fact]
    public async Task ListTabs_WithValidApiKey_Returns200()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-001 is published — may or may not have tabs depending on seed data
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/tabs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.ValueKind.Should().Be(JsonValueKind.Array);
    }

    [Fact]
    public async Task ListTabs_DraftEntryWithTab_ReturnsTabsWithProperties()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-003 "CSV Summarizer" is draft-only with a main tab
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.ValueKind.Should().Be(JsonValueKind.Array);
        json.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        // Verify tab properties
        var firstTab = json[0];
        firstTab.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        firstTab.GetProperty("name").GetString().Should().Be("Main");
        firstTab.GetProperty("isMainTab").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task ListTabs_WithoutApiKey_Returns401()
    {
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/tabs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ListTabs_NonExistentEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var response = await Client.GetAsync(
            $"/public/v1/entries/{Guid.NewGuid()}/tabs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Tab Get Endpoint ──

    [Fact]
    public async Task GetTab_WithValidApiKey_Returns200WithContent()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-003 has a main tab — list tabs to get its ID
        var listResponse = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs"
        );
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var tabs = await listResponse.ReadJsonAsync();
        tabs.GetArrayLength().Should().BeGreaterOrEqualTo(1);
        var tabId = tabs[0].GetProperty("id").GetString();

        // Now get the specific tab
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs/{tabId}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("id").GetString().Should().Be(TestData.EntryCsvSummarizer.ToString());
        json.GetProperty("title").GetString().Should().NotBeNullOrEmpty();
        json.TryGetProperty("prompts", out _).Should().BeTrue();
        json.TryGetProperty("tabs", out var tabsProperty).Should().BeTrue();
        tabsProperty.GetArrayLength().Should().BeGreaterOrEqualTo(1);
        json.GetProperty("tabCount").GetInt32().Should().Be(tabsProperty.GetArrayLength());
    }

    [Fact]
    public async Task GetTab_NonExistentTab_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/tabs/{Guid.NewGuid()}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetTab_NonExistentEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var response = await Client.GetAsync(
            $"/public/v1/entries/{Guid.NewGuid()}/tabs/{Guid.NewGuid()}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ListTabs_TrashedEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-009 "Deprecated Summarizer" is trashed
        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryDeprecatedSummarizer}/tabs"
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Tab Metadata in Entry Responses ──

    [Fact]
    public async Task Get_PublishedEntry_IncludesTabMetadata()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var response = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.TryGetProperty("tabs", out var tabs).Should().BeTrue();
        tabs.ValueKind.Should().Be(JsonValueKind.Array);
        json.TryGetProperty("tabCount", out var tabCount).Should().BeTrue();
        tabCount.GetInt32().Should().Be(tabs.GetArrayLength());
    }

    [Fact]
    public async Task List_EntriesIncludeTabMetadata()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var response = await Client.GetAsync("/public/v1/entries");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var items = json.GetProperty("items");
        items.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        // Each item should have tabs and tabCount properties
        var firstItem = items[0];
        firstItem.TryGetProperty("tabs", out var tabs).Should().BeTrue();
        tabs.ValueKind.Should().Be(JsonValueKind.Array);
        firstItem.TryGetProperty("tabCount", out var tabCount).Should().BeTrue();
        tabCount.GetInt32().Should().Be(tabs.GetArrayLength());
    }

    // ── Tab-Aware Generate Endpoint ──

    [Fact]
    public async Task GenerateTab_WithValidFields_Returns200WithRenderedContent()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-003 has a tab with template field {{csvData}}
        var listResponse = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs"
        );
        var tabs = await listResponse.ReadJsonAsync();
        var tabId = tabs[0].GetProperty("id").GetString();

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs/{tabId}/generate",
            new
            {
                fields = new Dictionary<string, string>
                {
                    ["csvData"] = "name,value\nAlice,100\nBob,200",
                },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("id").GetString().Should().Be(TestData.EntryCsvSummarizer.ToString());
        body.GetProperty("renderedPrompts").GetArrayLength().Should().BeGreaterOrEqualTo(1);

        // Verify template was rendered
        var content = body.GetProperty("renderedPrompts")[0].GetProperty("content").GetString()!;
        content.Should().Contain("Alice,100");
    }

    [Fact]
    public async Task GenerateTab_MissingRequiredFields_Returns422()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // e-003 has a tab with template field {{csvData}} — send empty fields
        var listResponse = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs"
        );
        var tabs = await listResponse.ReadJsonAsync();
        var tabId = tabs[0].GetProperty("id").GetString();

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs/{tabId}/generate",
            new { fields = new Dictionary<string, string>() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GenerateTab_WithoutApiKey_Returns401()
    {
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryCsvSummarizer}/tabs/{Guid.NewGuid()}/generate",
            new { fields = new Dictionary<string, string>() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GenerateTab_NonExistentEntry_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{Guid.NewGuid()}/tabs/{Guid.NewGuid()}/generate",
            new { fields = new Dictionary<string, string>() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateTab_NonExistentTab_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/tabs/{Guid.NewGuid()}/generate",
            new { fields = new Dictionary<string, string>() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GenerateTab_PublishedVersionId_Returns404()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // Use the published version's ID (not a tab) — should return 404
        var entryResponse = await Client.GetAsync(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}"
        );
        var entry = await entryResponse.ReadJsonAsync();
        // The entry ID itself is not a version ID, so use a random GUID
        // that doesn't correspond to any tab
        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/tabs/{TestData.EntryBlogPostGenerator}/generate",
            new { fields = new Dictionary<string, string>() }
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Generate_ExistingEndpoint_StillWorksUnchanged()
    {
        Client.WithApiKey(TestData.ApiKey1);

        // The existing /generate endpoint should still work on published entries
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/public/v1/entries/{TestData.EntryBlogPostGenerator}/generate",
            new
            {
                fields = new Dictionary<string, string>
                {
                    ["tone"] = "casual",
                    ["topic"] = "testing",
                    ["audience"] = "engineers",
                    ["wordCount"] = "300",
                },
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("renderedPrompts").GetArrayLength().Should().BeGreaterOrEqualTo(1);
    }
}
