using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryTagFilterTests : IntegrationTestBase
{
    public EntryTagFilterTests(IntegrationTestFixture fixture) : base(fixture) { }

    private async Task<string> CreateEntryWithTagsAsync(string token, string[] tags)
    {
        Client.WithBearerToken(token);
        var (response, body) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Test prompt" } }
        });
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var entryId = body.GetProperty("id").GetString()!;

        if (tags.Length > 0)
        {
            var tagResponse = await Client.PostAsJsonAsync($"/api/entries/{entryId}/tags", new { tags });
            tagResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        return entryId;
    }

    [Fact]
    public async Task ListByTagsOrMode_ReturnsEntriesMatchingAnyTag()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);

        var entryId1 = await CreateEntryWithTagsAsync(token, ["filter-or-a"]);
        var entryId2 = await CreateEntryWithTagsAsync(token, ["filter-or-b"]);
        // Entry with neither tag — should not appear
        var entryId3 = await CreateEntryWithTagsAsync(token, ["filter-or-unrelated"]);

        Client.WithBearerToken(token);
        var response = await Client.GetAsync("/api/entries?folderId=all&tags=filter-or-a,filter-or-b");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var ids = json.GetProperty("items").EnumerateArray()
            .Select(e => e.GetProperty("id").GetString())
            .ToList();

        ids.Should().Contain(entryId1);
        ids.Should().Contain(entryId2);
        ids.Should().NotContain(entryId3);
    }

    [Fact]
    public async Task ListByTagsAndMode_ReturnsOnlyEntriesWithAllTags()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);

        var entryBoth = await CreateEntryWithTagsAsync(token, ["filter-and-x", "filter-and-y"]);
        var entryOnlyX = await CreateEntryWithTagsAsync(token, ["filter-and-x"]);
        var entryOnlyY = await CreateEntryWithTagsAsync(token, ["filter-and-y"]);

        Client.WithBearerToken(token);
        var response = await Client.GetAsync("/api/entries?folderId=all&tags=filter-and-x,filter-and-y&tagMode=and");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var ids = json.GetProperty("items").EnumerateArray()
            .Select(e => e.GetProperty("id").GetString())
            .ToList();

        ids.Should().Contain(entryBoth);
        ids.Should().NotContain(entryOnlyX);
        ids.Should().NotContain(entryOnlyY);
    }

    [Fact]
    public async Task ListByTags_NoMatches_ReturnsEmptyList()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/entries?folderId=all&tags=nonexistent-tag-xyz");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("items").GetArrayLength().Should().Be(0);
        json.GetProperty("totalCount").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task ListByTags_SingleTag_ReturnsMatchingEntries()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);

        var entryId = await CreateEntryWithTagsAsync(token, ["filter-single-unique"]);

        Client.WithBearerToken(token);
        var response = await Client.GetAsync("/api/entries?folderId=all&tags=filter-single-unique");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var ids = json.GetProperty("items").EnumerateArray()
            .Select(e => e.GetProperty("id").GetString())
            .ToList();

        ids.Should().Contain(entryId);
    }
}
