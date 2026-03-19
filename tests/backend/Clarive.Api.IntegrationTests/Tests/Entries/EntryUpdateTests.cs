using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryUpdateTests : IntegrationTestBase
{
    public EntryUpdateTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Update_DraftEntry_OverwritesKeepsV1()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a fresh draft entry
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                systemMessage = "Original system message",
                prompts = new[] { new { content = "Original prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        // Update the draft
        var content = JsonContent.Create(
            new
            {
                title = "Updated Title",
                systemMessage = "Updated system message",
                prompts = new[] { new { content = "Updated prompt" } },
            }
        );
        var response = await Client.PutAsync($"/api/entries/{entryId}", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("title").GetString().Should().Be("Updated Title");
        json.GetProperty("systemMessage").GetString().Should().Be("Updated system message");
        json.GetProperty("version").GetInt32().Should().Be(1); // still v1
        json.GetProperty("versionState").GetString().Should().Be("draft");
    }

    [Fact]
    public async Task Update_PublishedEntry_CreatesNewDraftVersion()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create + publish
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "V1 prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        await Client.PostAsync($"/api/entries/{entryId}/publish", null);

        // Update the now-published entry
        var content = JsonContent.Create(
            new { title = "V2 Title", prompts = new[] { new { content = "V2 prompt" } } }
        );
        var response = await Client.PutAsync($"/api/entries/{entryId}", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("version").GetInt32().Should().Be(2); // new draft v2
        json.GetProperty("versionState").GetString().Should().Be("draft");
        json.GetProperty("title").GetString().Should().Be("V2 Title");
    }
}
