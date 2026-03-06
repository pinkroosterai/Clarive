using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthLoginTests : IntegrationTestBase
{
    public AuthLoginTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsTokenAndUser()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = TestData.AdminEmail,
            password = TestData.SeedPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("token").GetString().Should().NotBeNullOrEmpty();

        var user = json.GetProperty("user");
        user.GetProperty("email").GetString().Should().Be(TestData.AdminEmail);
        user.GetProperty("name").GetString().Should().Be("Admin User");
        user.GetProperty("role").GetString().Should().Be("admin");
        user.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = TestData.AdminEmail,
            password = "wrong-password"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_NonexistentEmail_Returns401()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "nobody@example.com",
            password = TestData.SeedPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
