using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Tenant;

[Collection("Integration")]
public class TenantUpdateTests : IntegrationTestBase
{
    public TenantUpdateTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task Update_AsAdmin_Returns200WithNewName()
    {
        // Register a fresh user to get a private workspace we can rename freely
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email,
                password = "securepassword123",
                name = "Tenant Tester",
            }
        );
        regResponse.EnsureSuccessStatusCode();
        var regJson = await regResponse.ReadJsonAsync();
        var freshToken = regJson.GetProperty("token").GetString()!;

        Client.WithBearerToken(freshToken);

        var newName = $"Renamed Workspace {Guid.NewGuid():N}"[..30];
        var (response, body) = await Client.PatchJsonAsync<JsonElement>(
            "/api/tenant",
            new { name = newName }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.GetProperty("name").GetString().Should().Be(newName);
    }

    [Fact]
    public async Task Update_EmptyName_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<JsonElement>(
            "/api/tenant",
            new { name = "   " }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Update_AsEditor_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<JsonElement>(
            "/api/tenant",
            new { name = "Should Fail" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Update_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<JsonElement>(
            "/api/tenant",
            new { name = "Should Fail" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
