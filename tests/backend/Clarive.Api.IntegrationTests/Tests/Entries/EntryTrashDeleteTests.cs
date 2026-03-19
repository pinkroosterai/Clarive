using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryTrashDeleteTests : IntegrationTestBase
{
    public EntryTrashDeleteTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Trash_Entry_Returns204()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a fresh entry to trash
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Will be trashed" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        var response = await Client.PostAsync($"/api/entries/{entryId}/trash", null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Restore_TrashedEntry_ReturnsEntry()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create + trash
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Will be restored" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        await Client.PostAsync($"/api/entries/{entryId}/trash", null);

        // Restore
        var response = await Client.PostAsync($"/api/entries/{entryId}/restore", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("isTrashed").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PermanentDelete_AsAdmin_TrashedEntry_Returns204()
    {
        // Editor creates + trashes
        var editorToken = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(editorToken);

        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Will be permanently deleted" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        await Client.PostAsync($"/api/entries/{entryId}/trash", null);

        // Admin permanently deletes
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);

        var response = await Client.DeleteAsync($"/api/entries/{entryId}/permanent-delete");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify it's gone
        var getResponse = await Client.GetAsync($"/api/entries/{entryId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PermanentDelete_NotTrashed_Returns409()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a fresh entry (not trashed)
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Not trashed" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/entries/{entryId}/permanent-delete");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task PermanentDelete_AsEditor_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create + trash
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "Editor tries to delete" } },
            }
        );
        var entryId = created.GetProperty("id").GetString();

        await Client.PostAsync($"/api/entries/{entryId}/trash", null);

        // Editor tries permanent delete (AdminOnly policy)
        var response = await Client.DeleteAsync($"/api/entries/{entryId}/permanent-delete");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
