using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Profile;

[Collection("Integration")]
public class ProfileUpdateTests : IntegrationTestBase
{
    public ProfileUpdateTests(IntegrationTestFixture fixture) : base(fixture) { }

    /// <summary>Registers a fresh user and returns the JWT token.</summary>
    private async Task<string> RegisterFreshUserAsync(string? password = "securePassword123")
    {
        var email = TestData.UniqueEmail();
        var response = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password,
            name = "Test User"
        });
        response.EnsureSuccessStatusCode();
        var json = await response.ReadJsonAsync();
        return json.GetProperty("token").GetString()!;
    }

    // ── Email Change ──

    [Fact]
    public async Task UpdateProfile_ChangeEmail_WithCurrentPassword_Succeeds()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var newEmail = TestData.UniqueEmail();
        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/profile", new
        {
            email = newEmail,
            currentPassword = "securePassword123"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("email").GetString().Should().Be(newEmail);
    }

    [Fact]
    public async Task UpdateProfile_ChangeEmail_WithoutPassword_Returns422()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<object>("/api/profile", new
        {
            email = TestData.UniqueEmail()
            // missing currentPassword
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task UpdateProfile_ChangeEmail_InvalidFormat_Returns422()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<object>("/api/profile", new
        {
            email = "not-an-email",
            currentPassword = "securePassword123"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Password Change ──

    [Fact]
    public async Task UpdateProfile_ChangePassword_Valid_Succeeds()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<JsonElement>("/api/profile", new
        {
            newPassword = "newSecurePassword456",
            currentPassword = "securePassword123"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateProfile_ChangePassword_WrongCurrent_Returns422()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<object>("/api/profile", new
        {
            newPassword = "newSecurePassword456",
            currentPassword = "wrongPassword123"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Theme Preference ──

    [Fact]
    public async Task UpdateProfile_ChangeTheme_Valid_Succeeds()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/profile", new
        {
            themePreference = "dark"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("themePreference").GetString().Should().Be("dark");
    }

    [Fact]
    public async Task UpdateProfile_InvalidTheme_Returns422()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<object>("/api/profile", new
        {
            themePreference = "neon"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Complete Onboarding ──

    [Fact]
    public async Task CompleteOnboarding_Succeeds()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var response = await Client.PostAsync("/api/profile/complete-onboarding", null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task CompleteOnboarding_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsync("/api/profile/complete-onboarding", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Revoke Other Sessions ──

    [Fact]
    public async Task RevokeOtherSessions_WithoutRefreshToken_Returns422()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var response = await Client.PostAsync("/api/profile/sessions/revoke-others", null);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Name Validation ──

    [Fact]
    public async Task UpdateProfile_NameTooLong_Returns422()
    {
        var token = await RegisterFreshUserAsync();
        Client.WithBearerToken(token);

        var (response, _) = await Client.PatchJsonAsync<object>("/api/profile", new
        {
            name = new string('A', 256)
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
