using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryPublishTests : IntegrationTestBase
{
    public EntryPublishTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Publish_DraftEntry_BecomesPublished()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a draft entry
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Prompt to publish" } }
        });
        var entryId = created.GetProperty("id").GetString();

        // Publish
        var response = await Client.PostAsync($"/api/entries/{entryId}/publish", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("versionState").GetString().Should().Be("published");
        json.GetProperty("version").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task Publish_AlreadyPublishedNoDraft_Returns409()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create + publish
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Prompt" } }
        });
        var entryId = created.GetProperty("id").GetString();

        await Client.PostAsync($"/api/entries/{entryId}/publish", null);

        // Try to publish again without a new draft
        var response = await Client.PostAsync($"/api/entries/{entryId}/publish", null);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
