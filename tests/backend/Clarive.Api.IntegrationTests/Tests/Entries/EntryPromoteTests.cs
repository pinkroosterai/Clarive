using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryPromoteTests : IntegrationTestBase
{
    public EntryPromoteTests(IntegrationTestFixture fixture) : base(fixture) { }

    /// <summary>
    /// Helper: create an entry, publish it, then edit + publish again to produce
    /// v1 (historical) and v2 (published).
    /// Returns (entryId, v1, v2).
    /// </summary>
    private async Task<(string EntryId, int HistoricalVersion, int PublishedVersion)> CreateEntryWithHistoricalVersionAsync()
    {
        // Create draft v1
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Original prompt content" } }
        });
        var entryId = created.GetProperty("id").GetString()!;

        // Publish v1
        await Client.PostAsync($"/api/entries/{entryId}/publish", null);

        // Update (creates v2 draft) and publish
        await Client.PutAsync($"/api/entries/{entryId}", JsonContent.Create(new
        {
            title = "Updated title",
            prompts = new[] { new { content = "Updated prompt content" } }
        }));
        await Client.PostAsync($"/api/entries/{entryId}/publish", null);

        // v1 = historical, v2 = published
        return (entryId, 1, 2);
    }

    [Fact]
    public async Task Promote_Historical_Creates_Draft_Not_Published()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (entryId, historicalVersion, publishedVersion) = await CreateEntryWithHistoricalVersionAsync();

        // Promote historical v1
        var response = await Client.PostAsync($"/api/entries/{entryId}/versions/{historicalVersion}/promote", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("versionState").GetString().Should().Be("draft");
        json.GetProperty("version").GetInt32().Should().Be(3); // v3 = new draft

        // Verify published version is still published (not demoted)
        var versionsResponse = await Client.GetAsync($"/api/entries/{entryId}/versions");
        var versions = await versionsResponse.ReadJsonAsync();

        var versionArray = versions.EnumerateArray().ToList();
        var v2 = versionArray.First(v => v.GetProperty("version").GetInt32() == publishedVersion);
        v2.GetProperty("versionState").GetString().Should().Be("published");
    }

    [Fact]
    public async Task Promote_Historical_Replaces_Existing_Draft()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (entryId, historicalVersion, _) = await CreateEntryWithHistoricalVersionAsync();

        // Create a draft v3 by updating the entry
        await Client.PutAsync($"/api/entries/{entryId}", JsonContent.Create(new
        {
            title = "Draft v3 title",
            prompts = new[] { new { content = "Draft v3 content" } }
        }));

        // Verify draft v3 exists
        var preVersions = await (await Client.GetAsync($"/api/entries/{entryId}/versions")).ReadJsonAsync();
        var preVersionArray = preVersions.EnumerateArray().ToList();
        preVersionArray.Should().HaveCount(3); // v1 historical, v2 published, v3 draft

        // Promote historical v1 — should replace draft v3
        var response = await Client.PostAsync($"/api/entries/{entryId}/versions/{historicalVersion}/promote", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("versionState").GetString().Should().Be("draft");
        json.GetProperty("version").GetInt32().Should().Be(4); // v4 = new draft (v3 was deleted)

        // Verify version history: v1 historical, v2 published, v4 draft (v3 gone)
        var postVersions = await (await Client.GetAsync($"/api/entries/{entryId}/versions")).ReadJsonAsync();
        var postVersionArray = postVersions.EnumerateArray().ToList();
        postVersionArray.Should().HaveCount(3); // v3 was deleted, v4 was created

        var states = postVersionArray
            .OrderBy(v => v.GetProperty("version").GetInt32())
            .Select(v => new
            {
                Version = v.GetProperty("version").GetInt32(),
                State = v.GetProperty("versionState").GetString()
            })
            .ToList();

        states[0].Version.Should().Be(1);
        states[0].State.Should().Be("historical");
        states[1].Version.Should().Be(2);
        states[1].State.Should().Be("published");
        states[2].Version.Should().Be(4);
        states[2].State.Should().Be("draft");
    }
}
