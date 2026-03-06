using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class SmokeTests : IntegrationTestBase
{
    public SmokeTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Login_WithSeedAdmin_ReturnsTokenAndUser()
    {
        // Arrange & Act
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email = TestData.AdminEmail,
            password = TestData.SeedPassword
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("token").GetString().Should().NotBeNullOrEmpty();
        json.GetProperty("user").GetProperty("email").GetString().Should().Be(TestData.AdminEmail);
        json.GetProperty("user").GetProperty("role").GetString().Should().Be("admin");
    }
}
