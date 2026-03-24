using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryRestoreTests : IntegrationTestBase
{
    public EntryRestoreTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    /// <summary>
    /// Helper: create an entry, publish v1, update + publish v2.
    /// Returns (entryId, mainTabId, v1=historical, v2=published).
    /// </summary>
    private async Task<(string EntryId, string MainTabId, int HistoricalVersion, int PublishedVersion)>
        CreateEntryWithHistoricalVersionAsync()
    {
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Original prompt" } },
            }
        );
        var entryId = created.GetProperty("id").GetString()!;

        // Get Main tab ID
        var tabsResponse = await Client.GetAsync($"/api/entries/{entryId}/tabs");
        var tabs = await tabsResponse.ReadJsonAsync();
        var mainTabId = tabs.EnumerateArray()
            .First(t => t.GetProperty("isMainTab").GetBoolean())
            .GetProperty("id").GetString()!;

        // Publish v1
        await Client.PostAsync($"/api/entries/{entryId}/tabs/{mainTabId}/publish", null);

        // Update tab and publish v2
        await Client.PutAsync(
            $"/api/entries/{entryId}",
            JsonContent.Create(new { prompts = new[] { new { content = "Updated prompt" } } })
        );
        await Client.PostAsync($"/api/entries/{entryId}/tabs/{mainTabId}/publish", null);

        return (entryId, mainTabId, 1, 2);
    }

    [Fact]
    public async Task RestoreVersion_CreatesNewTab()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (entryId, _, historicalVersion, publishedVersion) =
            await CreateEntryWithHistoricalVersionAsync();

        // Restore v1 (creates new tab)
        var response = await Client.PostAsync(
            $"/api/entries/{entryId}/versions/{historicalVersion}/restore",
            JsonContent.Create(new { })
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("versionState").GetString().Should().Be("tab");

        // Verify published version is still published
        var versionsResponse = await Client.GetAsync($"/api/entries/{entryId}/versions");
        var versions = await versionsResponse.ReadJsonAsync();
        var v2 = versions.EnumerateArray()
            .First(v => v.GetProperty("version").GetInt32() == publishedVersion);
        v2.GetProperty("versionState").GetString().Should().Be("published");

        // Verify tabs list now has 2 tabs (Main + restored)
        var tabsResponse = await Client.GetAsync($"/api/entries/{entryId}/tabs");
        var tabs = await tabsResponse.ReadJsonAsync();
        tabs.GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task RestoreVersion_NonHistorical_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (entryId, _, _, publishedVersion) =
            await CreateEntryWithHistoricalVersionAsync();

        // Try to restore the published version (not historical)
        var response = await Client.PostAsync(
            $"/api/entries/{entryId}/versions/{publishedVersion}/restore",
            JsonContent.Create(new { })
        );

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
