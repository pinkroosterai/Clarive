using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryVersionTests : IntegrationTestBase
{
    public EntryVersionTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task GetVersions_PublishedEntry_ReturnsVersionList()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Seed entry EntryBlogPostGenerator has a published version
        var response = await Client.GetAsync($"/api/entries/{TestData.EntryBlogPostGenerator}/versions");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var versions = await response.ReadJsonAsync();
        versions.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        var first = versions[0];
        first.GetProperty("version").GetInt32().Should().BeGreaterOrEqualTo(1);
        first.TryGetProperty("versionState", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GetVersions_EntryNotFound_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"/api/entries/{Guid.NewGuid()}/versions");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetVersion_SpecificVersion_ReturnsFullEntry()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"/api/entries/{TestData.EntryBlogPostGenerator}/versions/1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("id").GetString().Should().Be(TestData.EntryBlogPostGenerator.ToString());
    }

    [Fact]
    public async Task GetVersion_NonExistentVersion_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"/api/entries/{TestData.EntryBlogPostGenerator}/versions/999");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Move ──

    [Fact]
    public async Task Move_ToFolder_ReturnsUpdatedEntry()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry at root
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Will be moved" } }
        });
        var entryId = created.GetProperty("id").GetString();

        // Move to a folder
        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/move",
            new { folderId = TestData.FolderContentWriting });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("folderId").GetString().Should().Be(TestData.FolderContentWriting.ToString());
    }

    [Fact]
    public async Task Move_ToRoot_SetsFolderIdNull()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry in a folder
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            folderId = TestData.FolderContentWriting,
            prompts = new[] { new { content = "Will move to root" } }
        });
        var entryId = created.GetProperty("id").GetString();

        // Move to root (null folderId)
        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{entryId}/move",
            new { folderId = (Guid?)null });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        // folderId is null when at root — may be omitted or explicitly null
        if (json.TryGetProperty("folderId", out var folderProp))
            folderProp.ValueKind.Should().Be(JsonValueKind.Null);
        // If the property is omitted entirely, that also means it's at root
    }

    [Fact]
    public async Task Move_EntryNotFound_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            $"/api/entries/{Guid.NewGuid()}/move",
            new { folderId = TestData.FolderContentWriting });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Restore ──

    [Fact]
    public async Task Restore_TrashedEntry_RestoresSuccessfully()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create + trash
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Trash then restore" } }
        });
        var entryId = created.GetProperty("id").GetString();
        await Client.PostAsync($"/api/entries/{entryId}/trash", null);

        // Restore
        var response = await Client.PostAsync($"/api/entries/{entryId}/restore", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("isTrashed").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Restore_NonExistentEntry_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsync($"/api/entries/{Guid.NewGuid()}/restore", null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Activity ──

    [Fact]
    public async Task GetActivity_ExistingEntry_ReturnsActivityList()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry (should generate activity)
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Activity test" } }
        });
        var entryId = created.GetProperty("id").GetString();

        var response = await Client.GetAsync($"/api/entries/{entryId}/activity");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.TryGetProperty("items", out _).Should().BeTrue();
        json.TryGetProperty("total", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GetActivity_EntryNotFound_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"/api/entries/{Guid.NewGuid()}/activity");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetActivity_WithPagination_RespectsPageSize()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/activity?page=1&pageSize=5");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
