using System.Net;
using System.Net.Http.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class SuperCreateUserTests : IntegrationTestBase
{
    public SuperCreateUserTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task CreateUser_ValidRequest_Returns201()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Get a workspace to assign
        var wsResponse = await Client.GetAsync("/api/super/workspaces");
        wsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var workspaces = await wsResponse.ReadJsonAsync();
        var workspaceId = workspaces[0].GetProperty("id").GetString();

        var email = TestData.UniqueEmail();
        var response = await Client.PostAsJsonAsync(
            "/api/super/users",
            new { name = "Test Created User", email, workspaceId, role = "Editor" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var json = await response.ReadJsonAsync();
        json.GetProperty("email").GetString().Should().Be(email);
        json.GetProperty("name").GetString().Should().Be("Test Created User");
        // In test env, email is not configured, so password should be returned
        json.GetProperty("generatedPassword").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_Returns409()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var wsResponse = await Client.GetAsync("/api/super/workspaces");
        var workspaces = await wsResponse.ReadJsonAsync();
        var workspaceId = workspaces[0].GetProperty("id").GetString();

        // Use existing seed user email
        var response = await Client.PostAsJsonAsync(
            "/api/super/users",
            new { name = "Duplicate", email = TestData.AdminEmail, workspaceId, role = "Editor" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateUser_MissingFields_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/super/users",
            new { name = "", email = "" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task CreateUser_NonSuperUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync(
            "/api/super/users",
            new { name = "Test", email = "test@test.com", workspaceId = System.Guid.NewGuid(), role = "Editor" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ListWorkspaces_AsSuperUser_ReturnsWorkspaces()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/workspaces");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetArrayLength().Should().BeGreaterOrEqualTo(1);
        json[0].TryGetProperty("id", out _).Should().BeTrue();
        json[0].TryGetProperty("name", out _).Should().BeTrue();
    }
}
