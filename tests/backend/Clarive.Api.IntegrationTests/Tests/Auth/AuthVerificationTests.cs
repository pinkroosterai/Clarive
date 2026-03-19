using System.Net;
using System.Net.Http.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class AuthVerificationTests : IntegrationTestBase
{
    public AuthVerificationTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task VerifyEmail_WithInvalidToken_ReturnsError()
    {
        var response = await Client.PostAsJsonAsync(
            "/api/auth/verify-email",
            new { token = "invalid_verification_token_value" }
        );

        response
            .StatusCode.Should()
            .BeOneOf(
                HttpStatusCode.BadRequest,
                HttpStatusCode.UnprocessableEntity,
                HttpStatusCode.NotFound
            );
    }

    [Fact]
    public async Task VerifyEmail_WithEmptyToken_Returns422()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/verify-email", new { token = "" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task ResendVerification_WhenAlreadyVerified_Returns409()
    {
        // Seed users have emailVerified=true
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.PostAsJsonAsync("/api/auth/resend-verification", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task ResendVerification_Unauthenticated_Returns401()
    {
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.PostAsJsonAsync("/api/auth/resend-verification", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
