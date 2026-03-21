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

    [Fact]
    public async Task SetColor_ValidColor_Returns200()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a folder to color
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = TestData.UniqueFolderName() }
        );
        var folderId = created.GetProperty("id").GetString();

        var (response, body) = await Client.PatchJsonAsync<JsonElement>(
            $"/api/folders/{folderId}/color",
            new { color = "blue" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("color").GetString().Should().Be("blue");
    }

    [Fact]
    public async Task SetColor_NullClears_Returns200()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create and color a folder
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = TestData.UniqueFolderName() }
        );
        var folderId = created.GetProperty("id").GetString();

        await Client.PatchJsonAsync<JsonElement>(
            $"/api/folders/{folderId}/color",
            new { color = "red" }
        );

        // Clear color
        var (response, body) = await Client.PatchJsonAsync<JsonElement>(
            $"/api/folders/{folderId}/color",
            new { color = (string?)null }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("color").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task SetColor_InvalidColor_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = TestData.UniqueFolderName() }
        );
        var folderId = created.GetProperty("id").GetString();

        var (response, _) = await Client.PatchJsonAsync<JsonElement>(
            $"/api/folders/{folderId}/color",
            new { color = "neon_rainbow" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetTree_ReturnsColorField()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create and color a folder
        var (_, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/folders",
            new { name = TestData.UniqueFolderName() }
        );
        var folderId = created.GetProperty("id").GetString();

        await Client.PatchJsonAsync<JsonElement>(
            $"/api/folders/{folderId}/color",
            new { color = "green" }
        );

        // Fetch tree and find our folder
        var viewerToken = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(viewerToken);
        var treeResponse = await Client.GetAsync("/api/folders");
        var tree = await treeResponse.ReadJsonAsync();

        var found = false;
        foreach (var folder in tree.EnumerateArray())
        {
            if (folder.GetProperty("id").GetString() == folderId)
            {
                folder.GetProperty("color").GetString().Should().Be("green");
                found = true;
                break;
            }
        }
        found.Should().BeTrue("the colored folder should appear in the tree");
    }
}
