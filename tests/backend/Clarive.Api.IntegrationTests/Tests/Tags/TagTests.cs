using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Tags;

[Collection("Integration")]
public class TagTests : IntegrationTestBase
{
    public TagTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ListTags_ReturnsTags()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/tags");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var tags = await response.ReadJsonAsync();
        tags.GetArrayLength().Should().BeGreaterOrEqualTo(0);
    }

    [Fact]
    public async Task RenameTag_AsAdmin_Returns204()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // First create an entry with a unique tag
        var editorToken = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(editorToken);

        var tagName = $"test-tag-{Guid.NewGuid():N}"[..30];
        var (createResponse, _) = await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Tag test" } },
            tags = new[] { tagName }
        });
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Rename as admin
        Client.WithBearerToken(token);
        var newTagName = $"renamed-{Guid.NewGuid():N}"[..30];
        var response = await Client.PutAsJsonAsync($"/api/tags/{tagName}", new { newName = newTagName });

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RenameTag_AsEditor_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PutAsJsonAsync("/api/tags/some-tag", new { newName = "new-name" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RenameTag_InvalidName_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PutAsJsonAsync("/api/tags/some-tag", new { newName = "INVALID!!!" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task DeleteTag_AsAdmin_Returns204()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create entry with tag first
        var editorToken = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(editorToken);

        var tagName = $"delete-tag-{Guid.NewGuid():N}"[..30];
        await Client.PostJsonAsync<JsonElement>("/api/entries", new
        {
            title = TestData.UniqueEntryTitle(),
            prompts = new[] { new { content = "Delete tag test" } },
            tags = new[] { tagName }
        });

        // Delete as admin
        Client.WithBearerToken(token);
        var response = await Client.DeleteAsync($"/api/tags/{tagName}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteTag_AsEditor_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync("/api/tags/some-tag");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListTags_Unauthenticated_Returns401()
    {
        var response = await Client.GetAsync("/api/tags");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
