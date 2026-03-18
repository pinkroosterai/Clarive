using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthRegisterTests : IntegrationTestBase
{
    public AuthRegisterTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Register_ValidData_Returns201WithTokenAndUser()
    {
        var email = TestData.UniqueEmail();

        var response = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "New Test User"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var json = await response.ReadJsonAsync();
        json.GetProperty("token").GetString().Should().NotBeNullOrEmpty();

        var user = json.GetProperty("user");
        user.GetProperty("email").GetString().Should().Be(email);
        user.GetProperty("name").GetString().Should().Be("New Test User");
        user.GetProperty("role").GetString().Should().Be("admin"); // first user is admin
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns409()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email = TestData.AdminEmail, // already exists in seed
            password = "securePassword123",
            name = "Duplicate User"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Register_ShortPassword_Returns422()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email = TestData.UniqueEmail(),
            password = "short",
            name = "Short Pass User"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
