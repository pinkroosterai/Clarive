using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Folders;

[Collection("Integration")]
public class FolderTests : IntegrationTestBase
{
    public FolderTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task GetTree_ReturnsNestedFolders()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/folders");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.ValueKind.Should().Be(JsonValueKind.Array);
        json.GetArrayLength().Should().BeGreaterOrEqualTo(3); // seed has 3 root-level folders
    }

    [Fact]
    public async Task Create_RootFolder_Returns201()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var folderName = TestData.UniqueFolderName();
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = folderName }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("name").GetString().Should().Be(folderName);
        body.TryGetProperty("parentId", out var parentId).Should().BeFalse();
    }

    [Fact]
    public async Task Create_NestedFolder_Returns201()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var folderName = TestData.UniqueFolderName();
        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = folderName, parentId = TestData.FolderContentWriting }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("name").GetString().Should().Be(folderName);
        body.GetProperty("parentId")
            .GetString()
            .Should()
            .Be(TestData.FolderContentWriting.ToString());
    }

    [Fact]
    public async Task Rename_Folder_Returns200()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a folder to rename
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = TestData.UniqueFolderName() }
        );
        var folderId = created.GetProperty("id").GetString();

        var newName = TestData.UniqueFolderName();
        var (response, body) = await Client.PatchJsonAsync<JsonElement>(
            $"/api/folders/{folderId}",
            new { name = newName }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("name").GetString().Should().Be(newName);
    }

    [Fact]
    public async Task Delete_EmptyFolder_Returns204()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a folder to delete
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = TestData.UniqueFolderName() }
        );
        var folderId = created.GetProperty("id").GetString();

        var response = await Client.DeleteAsync($"/api/folders/{folderId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Delete_NonEmptyFolder_Returns409()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // FolderContentWriting has child folders (BlogPosts) and entries — should not be deletable
        var response = await Client.DeleteAsync($"/api/folders/{TestData.FolderContentWriting}");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
