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
    public async Task Update_TabEntry_OverwritesInPlace()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a fresh tab entry
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

        // Update the tab
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
        json.GetProperty("version").GetInt32().Should().Be(0); // still v0 tab
        json.GetProperty("versionState").GetString().Should().Be("tab");
    }

    [Fact]
    public async Task Update_Tab_UpdatesInPlace()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry (has Main tab)
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Original prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        // Update the tab directly (no auto-draft creation)
        var content = JsonContent.Create(
            new { title = "Updated Title", prompts = new[] { new { content = "Updated prompt" } } }
        );
        var response = await Client.PutAsync($"/api/entries/{entryId}", content);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("versionState").GetString().Should().Be("tab");
        json.GetProperty("title").GetString().Should().Be("Updated Title");
    }
}
