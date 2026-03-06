using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class ThemePreferenceTests : IntegrationTestBase
{
    public ThemePreferenceTests(IntegrationTestFixture fixture) : base(fixture) { }

    private async Task<(string Token, HttpClient Client)> RegisterFreshUserAsync()
    {
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Theme Test User"
        });
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);
        return (token, Client);
    }

    [Fact]
    public async Task UpdateProfile_SetThemeDark_Returns200WithPreference()
    {
        await RegisterFreshUserAsync();

        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/auth/profile", new
        {
            themePreference = "dark"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("themePreference").GetString().Should().Be("dark");
    }

    [Fact]
    public async Task UpdateProfile_SetThemeLight_Returns200WithPreference()
    {
        await RegisterFreshUserAsync();

        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/auth/profile", new
        {
            themePreference = "light"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("themePreference").GetString().Should().Be("light");
    }

    [Fact]
    public async Task UpdateProfile_SetThemeSystem_Returns200WithPreference()
    {
        await RegisterFreshUserAsync();

        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/auth/profile", new
        {
            themePreference = "system"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("themePreference").GetString().Should().Be("system");
    }

    [Fact]
    public async Task UpdateProfile_InvalidTheme_Returns422()
    {
        await RegisterFreshUserAsync();

        var (response, _) = await Client.PatchJsonAsync<object>("/api/auth/profile", new
        {
            themePreference = "invalid-value"
        });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task UpdateProfile_ThemePreferencePersistsInGetMe()
    {
        await RegisterFreshUserAsync();

        // Set theme
        await Client.PatchJsonAsync<JsonElement>("/api/auth/profile", new
        {
            themePreference = "light"
        });

        // Verify it persists via GET /me
        var meResponse = await Client.GetAsync("/api/auth/me");
        meResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var meJson = await meResponse.ReadJsonAsync();
        meJson.GetProperty("themePreference").GetString().Should().Be("light");
    }

    [Fact]
    public async Task UpdateProfile_ThemeWithOtherFields_BothApplied()
    {
        await RegisterFreshUserAsync();

        var (response, json) = await Client.PatchJsonAsync<JsonElement>("/api/auth/profile", new
        {
            name = "Updated Name",
            themePreference = "dark"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        json.GetProperty("name").GetString().Should().Be("Updated Name");
        json.GetProperty("themePreference").GetString().Should().Be("dark");
    }

    [Fact]
    public async Task NewUser_ThemePreferenceIsNull()
    {
        await RegisterFreshUserAsync();

        var meResponse = await Client.GetAsync("/api/auth/me");
        var meJson = await meResponse.ReadJsonAsync();
        meJson.GetProperty("themePreference").ValueKind.Should().Be(JsonValueKind.Null);
    }
}
