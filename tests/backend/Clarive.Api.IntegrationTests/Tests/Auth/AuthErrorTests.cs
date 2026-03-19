using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthErrorTests : IntegrationTestBase
{
    public AuthErrorTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    // ── Invalid email format ──

    [Fact]
    public async Task Login_InvalidEmailFormat_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "not-an-email", password = TestData.SeedPassword }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Register_InvalidEmailFormat_Returns422()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = "missing-at-sign",
                password = "securePassword123",
                name = "Test",
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Register_EmptyName_Returns422()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = TestData.UniqueEmail(),
                password = "securePassword123",
                name = "",
            }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Malformed JWT ──

    [Fact]
    public async Task GetMe_MalformedJwt_Returns401()
    {
        Client.WithBearerToken("this.is.not.a.valid.jwt");

        var response = await Client.GetAsync("/api/profile/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_EmptyBearerToken_Returns401()
    {
        Client.WithBearerToken("");

        var response = await Client.GetAsync("/api/profile/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Expired/invalid refresh token ──

    [Fact]
    public async Task Refresh_ExpiredRefreshToken_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = "expired-or-fake-refresh-token" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Login edge cases ──

    [Fact]
    public async Task Login_EmptyPassword_Returns401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = TestData.AdminEmail, password = "" }
        );

        // Should fail — empty password cannot match
        response
            .StatusCode.Should()
            .BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Login_NullEmail_Returns422Or401()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/login",
            new { email = (string?)null, password = "somepassword" }
        );

        response
            .StatusCode.Should()
            .BeOneOf(
                HttpStatusCode.Unauthorized,
                HttpStatusCode.UnprocessableEntity,
                HttpStatusCode.BadRequest
            );
    }

    // ── Password reset edge cases ──

    [Fact]
    public async Task ResetPassword_ShortPassword_Returns422()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/reset-password",
            new { token = "some-token", newPassword = "short" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task ForgotPassword_InvalidEmailFormat_Returns200()
    {
        // Should still return 200 to prevent email enumeration
        var response = await Client.PostAsJsonAsync(
            "/api/auth/forgot-password",
            new { email = "not-an-email" }
        );

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
