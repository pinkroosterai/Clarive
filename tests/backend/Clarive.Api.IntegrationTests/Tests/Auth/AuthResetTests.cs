using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthResetTests : IntegrationTestBase
{
    public AuthResetTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task ForgotPassword_WithValidEmail_Returns200()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", new
        {
            email = TestData.AdminEmail
        });

        // Always returns 200 to prevent email enumeration
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ForgotPassword_WithUnknownEmail_Returns200()
    {
        // Should still return 200 to prevent email enumeration
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", new
        {
            email = "nonexistent@example.com"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ResetPassword_WithInvalidToken_ReturnsError()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/reset-password", new
        {
            token = "invalid_reset_token_value",
            newPassword = "NewPassword123!"
        });

        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.UnprocessableEntity,
            HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ResetPassword_WithEmptyToken_Returns422()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/reset-password", new
        {
            token = "",
            newPassword = "NewPassword123!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task ForgotPassword_WithEmptyEmail_Returns200()
    {
        // Returns 200 to prevent email enumeration (same as valid email)
        var response = await Client.PostAsJsonAsync("/api/auth/forgot-password", new
        {
            email = ""
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
