using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using SkiaSharp;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Workspaces;

[Collection("Integration")]
public class WorkspaceAvatarTests : IntegrationTestBase
{
    public WorkspaceAvatarTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    // ── Upload ──

    [Fact]
    public async Task UploadAvatar_Admin_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await UploadTestImageAsync();

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("avatarUrl").GetString().Should().Contain("/api/tenants/");
    }

    [Fact]
    public async Task UploadAvatar_NonAdmin_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await UploadTestImageAsync();

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UploadAvatar_TooLarge_Returns413()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // 4 MB of random bytes
        var largeBytes = new byte[4 * 1024 * 1024];
        new Random(42).NextBytes(largeBytes);

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(largeBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(fileContent, "avatar", "large.png");

        var response = await Client.PostAsync("/api/tenant/avatar", content);

        response.StatusCode.Should().Be(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task UploadAvatar_InvalidType_Returns422()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent("not an image"u8.ToArray());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        content.Add(fileContent, "avatar", "test.txt");

        var response = await Client.PostAsync("/api/tenant/avatar", content);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    // ── Serve ──

    [Fact]
    public async Task ServeAvatar_AfterUpload_ReturnsImage()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var uploadResponse = await UploadTestImageAsync();
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var uploadJson = await uploadResponse.ReadJsonAsync();
        var avatarUrl = uploadJson.GetProperty("avatarUrl").GetString()!;

        // Serve (no auth needed)
        Client.DefaultRequestHeaders.Authorization = null;
        var serveResponse = await Client.GetAsync(avatarUrl);

        serveResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        serveResponse.Content.Headers.ContentType!.MediaType.Should().Be("image/webp");
    }

    [Fact]
    public async Task ServeAvatar_NotExists_Returns404()
    {
        Client.DefaultRequestHeaders.Authorization = null;
        var response = await Client.GetAsync($"/api/tenants/{Guid.NewGuid()}/avatar");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Delete ──

    [Fact]
    public async Task DeleteAvatar_Admin_Returns204()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Upload first
        var uploadResponse = await UploadTestImageAsync();
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var uploadJson = await uploadResponse.ReadJsonAsync();
        var avatarUrl = uploadJson.GetProperty("avatarUrl").GetString()!;

        // Delete
        var deleteResponse = await Client.DeleteAsync("/api/tenant/avatar");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verify serve now returns 404
        Client.DefaultRequestHeaders.Authorization = null;
        var serveResponse = await Client.GetAsync(avatarUrl);
        serveResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteAvatar_NonAdmin_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.DeleteAsync("/api/tenant/avatar");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── WorkspaceDto includes avatarUrl ──

    [Fact]
    public async Task WorkspaceList_IncludesAvatarUrl()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        // Upload avatar
        var uploadResponse = await UploadTestImageAsync();
        uploadResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // List workspaces
        var listResponse = await Client.GetAsync("/api/workspaces");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await listResponse.ReadJsonAsync();
        var workspaces = json.GetProperty("workspaces");

        // Find the seed workspace and verify avatarUrl
        var seedWs = workspaces
            .EnumerateArray()
            .First(w => w.GetProperty("id").GetString() == TestData.TenantId.ToString());

        seedWs.TryGetProperty("avatarUrl", out var avatarUrlProp).Should().BeTrue();
        avatarUrlProp.GetString().Should().Contain("/api/tenants/");
    }

    // ── Helpers ──

    private async Task<HttpResponseMessage> UploadTestImageAsync()
    {
        // Create a minimal valid PNG via SkiaSharp
        using var bitmap = new SKBitmap(64, 64);
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(SKColors.CornflowerBlue);

        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        var bytes = data.ToArray();

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(fileContent, "avatar", "test-avatar.png");

        return await Client.PostAsync("/api/tenant/avatar", content);
    }
}
