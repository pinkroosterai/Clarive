using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.ShareLinks;

[Collection("Integration")]
public class ShareLinkTests : IntegrationTestBase
{
    public ShareLinkTests(IntegrationTestFixture fixture) : base(fixture) { }

    private async Task<string> AuthAsAdmin()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);
        return token;
    }

    private async Task<string> AuthAsEditor()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);
        return token;
    }

    // ── Create ──

    [Fact]
    public async Task CreateShareLink_PublishedEntry_Returns201WithToken()
    {
        await AuthAsAdmin();

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/share-link",
            new { });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body!.GetProperty("token").GetString().Should().StartWith("sl_");
        body!.GetProperty("entryId").GetString().Should().Be(TestData.EntryBlogPostGenerator.ToString());
    }

    [Fact]
    public async Task CreateShareLink_DraftOnlyEntry_Returns422()
    {
        await AuthAsAdmin();

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryCsvSummarizer}/share-link",
            new { });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task CreateShareLink_WithExpiry_SetsExpiresAt()
    {
        await AuthAsAdmin();
        var expiry = DateTime.UtcNow.AddDays(7);

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryCodeReviewPipeline}/share-link",
            new { expiresAt = expiry.ToString("O") });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body!.GetProperty("expiresAt").GetString().Should().NotBeNull();
    }

    [Fact]
    public async Task CreateShareLink_WithPassword_SetsHasPassword()
    {
        await AuthAsAdmin();

        var (response, body) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryTutorialWriter}/share-link",
            new { password = "test-password" });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        body!.GetProperty("hasPassword").GetBoolean().Should().BeTrue();
    }

    // ── Get ──

    [Fact]
    public async Task GetShareLink_Existing_Returns200()
    {
        await AuthAsAdmin();

        // Create first
        await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntrySalesAnalyzer}/share-link",
            new { });

        var response = await Client.GetAsync($"/api/entries/{TestData.EntrySalesAnalyzer}/share-link");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("entryId").GetString().Should().Be(TestData.EntrySalesAnalyzer.ToString());
    }

    [Fact]
    public async Task GetShareLink_NonExisting_Returns404()
    {
        await AuthAsAdmin();

        var response = await Client.GetAsync($"/api/entries/{TestData.EntryOwaspChecker}/share-link");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Revoke ──

    [Fact]
    public async Task RevokeShareLink_Existing_Returns204()
    {
        await AuthAsAdmin();

        // Create first
        await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryEmailToneAdjuster}/share-link",
            new { });

        var response = await Client.DeleteAsync(
            $"/api/entries/{TestData.EntryEmailToneAdjuster}/share-link");
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify it's gone
        var getResponse = await Client.GetAsync(
            $"/api/entries/{TestData.EntryEmailToneAdjuster}/share-link");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Public Access ──

    [Fact]
    public async Task PublicAccess_ValidToken_Returns200()
    {
        await AuthAsAdmin();

        // Create share link
        var (_, createBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntrySeoMetaGenerator}/share-link",
            new { });

        var shareToken = createBody!.GetProperty("token").GetString()!;

        // Access publicly (clear auth headers)
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/share/{Uri.EscapeDataString(shareToken)}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("title").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task PublicAccess_InvalidToken_Returns404()
    {
        Client.DefaultRequestHeaders.Authorization = null;

        var response = await Client.GetAsync("/api/share/sl_invalid-token-does-not-exist");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PublicAccess_PasswordProtected_Returns403ThenOkWithPassword()
    {
        await AuthAsAdmin();

        // Create password-protected link
        var (_, createBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/share-link",
            new { password = "secret123" });

        var shareToken = createBody!.GetProperty("token").GetString()!;

        // Access without password — should get 403
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/share/{Uri.EscapeDataString(shareToken)}");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var forbiddenBody = await response.ReadJsonAsync();
        forbiddenBody.GetProperty("passwordRequired").GetBoolean().Should().BeTrue();

        // Verify with correct password
        var (verifyResponse, verifyBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/share/{Uri.EscapeDataString(shareToken)}/verify",
            new { password = "secret123" });

        verifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        verifyBody!.GetProperty("title").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task PublicAccess_WrongPassword_Returns401()
    {
        await AuthAsAdmin();

        // Create password-protected link
        var (_, createBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/share-link",
            new { password = "correct-password" });

        var shareToken = createBody!.GetProperty("token").GetString()!;

        Client.DefaultRequestHeaders.Authorization = null;

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/share/{Uri.EscapeDataString(shareToken)}/verify",
            new { password = "wrong-password" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Regenerate ──

    [Fact]
    public async Task Regenerate_InvalidatesOldToken()
    {
        await AuthAsAdmin();

        // Create first link
        var (_, firstBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/share-link",
            new { });
        var firstToken = firstBody!.GetProperty("token").GetString()!;

        // Regenerate
        var (_, secondBody) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/share-link",
            new { });
        var secondToken = secondBody!.GetProperty("token").GetString()!;

        secondToken.Should().NotBe(firstToken);

        // Old token should be invalid
        Client.DefaultRequestHeaders.Authorization = null;
        var oldResponse = await Client.GetAsync($"/api/share/{Uri.EscapeDataString(firstToken)}");
        oldResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // New token should work
        var newResponse = await Client.GetAsync($"/api/share/{Uri.EscapeDataString(secondToken)}");
        newResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Viewer access ──

    [Fact]
    public async Task CreateShareLink_AsViewer_Returns403()
    {
        var token = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(token);

        var (response, _) = await Client.PostJsonAsync<JsonElement>(
            $"/api/entries/{TestData.EntryBlogPostGenerator}/share-link",
            new { });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
