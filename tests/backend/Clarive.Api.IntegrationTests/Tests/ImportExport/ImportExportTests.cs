using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.ImportExport;

[Collection("Integration")]
public class ImportExportTests : IntegrationTestBase
{
    public ImportExportTests(IntegrationTestFixture fixture) : base(fixture) { }

    // ── Export ──

    [Fact]
    public async Task Export_AllEntries_ReturnsYamlFile()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/export", new { });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/x-yaml");
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("entries:");
    }

    [Fact]
    public async Task Export_ByFolderIds_ReturnsFilteredEntries()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/export", new
        {
            folderIds = new[] { TestData.FolderContentWriting }
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("entries:");
    }

    [Fact]
    public async Task Export_ByEntryIds_ReturnsSpecificEntries()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/export", new
        {
            entryIds = new[] { TestData.EntryBlogPostGenerator }
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("entries:");
        content.Should().Contain("Blog Post Generator");
    }

    [Fact]
    public async Task Export_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/export", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Export_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsJsonAsync("/api/export", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Import ──

    [Fact]
    public async Task Import_ValidYaml_ReturnsOk()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var yaml = """
            entries:
              - title: Imported Entry
                prompts:
                  - content: Test imported prompt
            """;

        var response = await PostYamlImport(yaml);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Import_EmptyFile_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Array.Empty<byte>());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/x-yaml");
        content.Add(fileContent, "file", "empty.yaml");
        var response = await Client.PostAsync("/api/import", content);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Import_InvalidYaml_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await PostYamlImport("{ invalid yaml: [[[");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var json = await response.ReadJsonAsync();
        json.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Import_MissingEntriesKey_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var yaml = """
            prompts:
              - title: Not an entry
            """;

        var response = await PostYamlImport(yaml);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var json = await response.ReadJsonAsync();
        json.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Import_TooManyEntries_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Build YAML with 501 entries (over 500 limit)
        var sb = new StringBuilder("entries:\n");
        for (var i = 0; i < 501; i++)
            sb.AppendLine($"  - title: Entry {i}\n    prompts:\n      - content: P{i}");

        var response = await PostYamlImport(sb.ToString());

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var json = await response.ReadJsonAsync();
        json.GetProperty("error").GetProperty("message").GetString().Should().Contain("500");
    }

    [Fact]
    public async Task Import_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var yaml = """
            entries:
              - title: Should fail
                prompts:
                  - content: Viewer cannot import
            """;

        var response = await PostYamlImport(yaml);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Helpers ──

    private async Task<HttpResponseMessage> PostYamlImport(string yamlContent)
    {
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(yamlContent));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/x-yaml");
        content.Add(fileContent, "file", "import.yaml");
        return await Client.PostAsync("/api/import", content);
    }
}
