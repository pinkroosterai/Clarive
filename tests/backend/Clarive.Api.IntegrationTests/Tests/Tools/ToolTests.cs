using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Tools;

[Collection("Integration")]
public class ToolTests : IntegrationTestBase
{
    public ToolTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task List_AsViewer_ReturnsSeedTools()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/tools");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("items").GetArrayLength().Should().BeGreaterOrEqualTo(4);
        json.GetProperty("total").GetInt32().Should().BeGreaterOrEqualTo(4);
    }

    [Fact]
    public async Task List_NoToken_Returns401()
    {
        var response = await Client.GetAsync("/api/tools");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_AsEditor_Returns201()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>("/api/tools", new
        {
            name = "Email Sender",
            toolName = "send_email",
            description = "Sends emails via SMTP"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("name").GetString().Should().Be("Email Sender");
        body.GetProperty("toolName").GetString().Should().Be("send_email");
    }

    [Fact]
    public async Task Create_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/tools", new
        {
            name = "Test",
            toolName = "test_tool",
            description = "Forbidden"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Create_EmptyName_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/tools", new
        {
            name = "",
            toolName = "test_tool",
            description = "Test"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Create_InvalidToolName_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/tools", new
        {
            name = "Test Tool",
            toolName = "invalid tool name!",
            description = "Test"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Update_AsEditor_Returns200()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create first
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/tools", new
        {
            name = "Original Tool",
            toolName = "orig_tool",
            description = "Original"
        });
        var toolId = created.GetProperty("id").GetString();

        // Update
        var (updateResponse, updated) = await Client.PatchJsonAsync<JsonElement>($"/api/tools/{toolId}", new
        {
            name = "Updated Tool",
            description = "Updated description"
        });

        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        updated.GetProperty("name").GetString().Should().Be("Updated Tool");
        updated.GetProperty("description").GetString().Should().Be("Updated description");
        updated.GetProperty("toolName").GetString().Should().Be("orig_tool");
    }

    [Fact]
    public async Task Update_NonExistent_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<JsonElement>($"/api/tools/{Guid.NewGuid()}", new
        {
            name = "Nope"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_AsEditor_Returns204()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create then delete
        var (_, created) = await Client.PostJsonAsync<JsonElement>("/api/tools", new
        {
            name = "To Delete",
            toolName = "to_delete",
            description = "Will be removed"
        });
        var toolId = created.GetProperty("id").GetString();

        var deleteResponse = await Client.DeleteAsync($"/api/tools/{toolId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Delete_NonExistent_Returns404()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync($"/api/tools/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ImportMcp_InvalidUrl_Returns422()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>("/api/tools/import-mcp", new
        {
            serverUrl = "not-a-valid-url"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
