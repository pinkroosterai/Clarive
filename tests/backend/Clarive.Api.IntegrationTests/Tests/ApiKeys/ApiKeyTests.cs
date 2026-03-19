using System.Net;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.ApiKeys;

[Collection("Integration")]
public class ApiKeyTests : IntegrationTestBase
{
    public ApiKeyTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task List_AsAdmin_ReturnsSeededKeys()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/api-keys");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var keys = await response.ReadJsonAsync();
        keys.GetArrayLength().Should().BeGreaterOrEqualTo(2);
    }

    [Fact]
    public async Task List_AsEditor_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/api-keys");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task List_NoToken_Returns401()
    {
        var response = await Client.GetAsync("/api/api-keys");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_AsAdmin_Returns201WithFullKey()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            "/api/api-keys",
            new { name = "Test API Key" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body.GetProperty("name").GetString().Should().Be("Test API Key");
        body.GetProperty("key").GetString().Should().StartWith("cl_");
        body.GetProperty("prefix").GetString().Should().Contain("••••");
    }

    [Fact]
    public async Task Create_EmptyName_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            "/api/api-keys",
            new { name = "   " }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Create_NameTooLong_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            "/api/api-keys",
            new { name = new string('x', 101) }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task CreateAndDelete_RoundTrip()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create
        var (createResponse, created) = await Client.PostJsonAsync<JsonElement>(
            "/api/api-keys",
            new { name = "Temp Key" }
        );
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var keyId = created.GetProperty("id").GetString();

        // Delete
        var deleteResponse = await Client.DeleteAsync($"/api/api-keys/{keyId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify deleted — listing should not contain this key
        var listResponse = await Client.GetAsync("/api/api-keys");
        var keys = await listResponse.ReadJsonAsync();
        keys.EnumerateArray().Any(k => k.GetProperty("id").GetString() == keyId).Should().BeFalse();
    }

    [Fact]
    public async Task Delete_NonExistent_Returns404()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync($"/api/api-keys/{Guid.NewGuid()}");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
