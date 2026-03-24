using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryPublishTests : IntegrationTestBase
{
    public EntryPublishTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task PublishTab_NewEntry_CreatesV1()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry (has Main tab)
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Prompt to publish" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        // Get tabs to find Main tab ID
        var tabsResponse = await Client.GetAsync($"/api/entries/{entryId}/tabs");
        var tabs = await tabsResponse.ReadJsonAsync();
        var mainTabId = tabs.EnumerateArray().First(t => t.GetProperty("isMainTab").GetBoolean())
            .GetProperty("id").GetString();

        // Publish the Main tab
        var response = await Client.PostAsync(
            $"/api/entries/{entryId}/tabs/{mainTabId}/publish", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("versionState").GetString().Should().Be("published");
        json.GetProperty("version").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task PublishTab_Republish_ArchivesOldVersion()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create + publish v1
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "V1" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        var tabsResponse = await Client.GetAsync($"/api/entries/{entryId}/tabs");
        var tabs = await tabsResponse.ReadJsonAsync();
        var mainTabId = tabs.EnumerateArray().First(t => t.GetProperty("isMainTab").GetBoolean())
            .GetProperty("id").GetString();

        await Client.PostAsync($"/api/entries/{entryId}/tabs/{mainTabId}/publish", null);

        // Update tab content and publish v2
        await Client.PutAsync(
            $"/api/entries/{entryId}",
            JsonContent.Create(new { prompts = new[] { new { content = "V2" } } })
        );

        var response = await Client.PostAsync(
            $"/api/entries/{entryId}/tabs/{mainTabId}/publish", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("version").GetInt32().Should().Be(2);

        // Verify v1 is now historical
        var versionsResponse = await Client.GetAsync($"/api/entries/{entryId}/versions");
        var versions = await versionsResponse.ReadJsonAsync();
        var v1 = versions.EnumerateArray().First(v => v.GetProperty("version").GetInt32() == 1);
        v1.GetProperty("versionState").GetString().Should().Be("historical");
    }
}
