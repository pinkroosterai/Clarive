using System.Net;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Entries;

[Collection("Integration")]
public class EntryReadTests : IntegrationTestBase
{
    public EntryReadTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task List_AllEntries_ReturnsAtLeastSeedCount()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/entries?folderId=all");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("page").GetInt32().Should().Be(1);
        json.GetProperty("pageSize").GetInt32().Should().Be(50);
        var totalCount = json.GetProperty("totalCount").GetInt32();
        totalCount.Should().BeGreaterThanOrEqualTo(9);
        var entries = json.GetProperty("items").EnumerateArray().ToList();
        // Seed has 9 non-trashed entries (e-009 is trashed)
        entries.Should().HaveCountGreaterThanOrEqualTo(9);
    }

    [Fact]
    public async Task List_ByFolder_ReturnsOnlyFolderEntries()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(
            $"/api/entries?folderId={TestData.FolderContentWriting}"
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var entries = json.GetProperty("items").EnumerateArray().ToList();
        // e-001 "Blog Post Generator" is in Content Writing
        entries.Should().HaveCountGreaterThanOrEqualTo(1);
        entries
            .Should()
            .AllSatisfy(e =>
                e.GetProperty("folderId")
                    .GetString()
                    .Should()
                    .Be(TestData.FolderContentWriting.ToString())
            );
    }

    [Fact]
    public async Task List_Trashed_ReturnsTrashedEntries()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/entries/trash");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("page").GetInt32().Should().Be(1);
        var entries = json.GetProperty("items").EnumerateArray().ToList();
        // Seed has 1 trashed entry (e-009)
        entries.Should().HaveCountGreaterThanOrEqualTo(1);
        entries.Should().AllSatisfy(e => e.GetProperty("isTrashed").GetBoolean().Should().BeTrue());
    }

    [Fact]
    public async Task Get_ById_ReturnsFullEntry()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"/api/entries/{TestData.EntryBlogPostGenerator}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("id").GetString().Should().Be(TestData.EntryBlogPostGenerator.ToString());
        json.GetProperty("title").GetString().Should().Be("Blog Post Generator");
        json.GetProperty("versionState").GetString().Should().Be("published");
        json.GetProperty("prompts").EnumerateArray().Should().NotBeEmpty();
    }

    [Fact]
    public async Task Get_NonexistentId_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"/api/entries/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
