using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Auth;

[Collection("Integration")]
public class OnboardingTests : IntegrationTestBase
{
    public OnboardingTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Register_CreatesStarterTemplatesInGettingStartedFolder()
    {
        // Register a new user
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Onboarding Test User"
        });
        regResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Fetch folders — should contain "Getting Started"
        var foldersResponse = await Client.GetAsync("/api/folders");
        foldersResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var folders = await foldersResponse.ReadJsonAsync();
        var folderList = folders.EnumerateArray().ToList();
        var gettingStarted = folderList.FirstOrDefault(f =>
            f.GetProperty("name").GetString() == "Getting Started");
        gettingStarted.ValueKind.Should().NotBe(System.Text.Json.JsonValueKind.Undefined,
            "a 'Getting Started' folder should exist after registration");

        var folderId = gettingStarted.GetProperty("id").GetString()!;

        // Fetch entries in that folder — should have 3 entries
        var entriesResponse = await Client.GetAsync($"/api/entries?folderId={folderId}");
        entriesResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var entriesJson = await entriesResponse.ReadJsonAsync();
        var entries = entriesJson.GetProperty("items").EnumerateArray().ToList();
        entries.Should().HaveCount(3);

        var titles = entries.Select(e => e.GetProperty("title").GetString()).ToList();
        titles.Should().Contain("Blog Post Writer");
        titles.Should().Contain("Code Review Assistant");
        titles.Should().Contain("Email Composer");
    }

    [Fact]
    public async Task Register_StarterEntriesArePublished()
    {
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Published Check User"
        });
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Get folders to find the Getting Started folder
        var foldersResponse = await Client.GetAsync("/api/folders");
        var folders = await foldersResponse.ReadJsonAsync();
        var folderId = folders.EnumerateArray()
            .First(f => f.GetProperty("name").GetString() == "Getting Started")
            .GetProperty("id").GetString()!;

        // Entries should be published
        var entriesResponse = await Client.GetAsync($"/api/entries?folderId={folderId}");
        var entriesJson = await entriesResponse.ReadJsonAsync();
        var entries = entriesJson.GetProperty("items").EnumerateArray().ToList();

        foreach (var entry in entries)
        {
            entry.GetProperty("versionState").GetString().Should().Be("published");
        }
    }

    [Fact]
    public async Task Register_SetsOnboardingCompletedFalse()
    {
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Onboarding Flag User"
        });

        var regJson = await regResponse.ReadJsonAsync();
        var user = regJson.GetProperty("user");
        user.GetProperty("onboardingCompleted").GetBoolean().Should().BeFalse();

        // Also verify via /me
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        var meResponse = await Client.GetAsync("/api/profile/me");
        var meJson = await meResponse.ReadJsonAsync();
        meJson.GetProperty("onboardingCompleted").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task CompleteOnboarding_SetsFlag()
    {
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Complete Onboarding User"
        });
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Complete onboarding
        var completeResponse = await Client.PostAsync("/api/profile/complete-onboarding", null);
        completeResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify via /me
        var meResponse = await Client.GetAsync("/api/profile/me");
        var meJson = await meResponse.ReadJsonAsync();
        meJson.GetProperty("onboardingCompleted").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task CompleteOnboarding_IsIdempotent()
    {
        var email = TestData.UniqueEmail();
        var regResponse = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "securePassword123",
            name = "Idempotent User"
        });
        var regJson = await regResponse.ReadJsonAsync();
        var token = regJson.GetProperty("token").GetString()!;
        Client.WithBearerToken(token);

        // Call twice — both should return 204
        var first = await Client.PostAsync("/api/profile/complete-onboarding", null);
        first.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var second = await Client.PostAsync("/api/profile/complete-onboarding", null);
        second.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task ExistingUsers_HaveOnboardingCompleted()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var meResponse = await Client.GetAsync("/api/profile/me");
        var meJson = await meResponse.ReadJsonAsync();
        meJson.GetProperty("onboardingCompleted").GetBoolean().Should().BeTrue();
    }
}
