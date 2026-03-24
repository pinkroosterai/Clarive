using System.Net;
using System.Text.Json;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Dashboard;

[Collection("Integration")]
public class DashboardStatsTests : IntegrationTestBase
{
    public DashboardStatsTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    [Fact]
    public async Task GetStats_WithValidToken_ReturnsExpectedShape()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/dashboard/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();

        // Verify all top-level properties exist and have correct types
        json.GetProperty("totalEntries").GetInt32().Should().BeGreaterOrEqualTo(0);
        json.GetProperty("publishedEntries").GetInt32().Should().BeGreaterOrEqualTo(0);
        json.GetProperty("unpublishedEntries").GetInt32().Should().BeGreaterOrEqualTo(0);
        json.GetProperty("totalFolders").GetInt32().Should().BeGreaterOrEqualTo(0);
        json.GetProperty("recentEntries").ValueKind.Should().Be(JsonValueKind.Array);
        json.GetProperty("recentActivity").ValueKind.Should().Be(JsonValueKind.Array);
    }

    [Fact]
    public async Task GetStats_ReturnsCorrectSeedCounts()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/dashboard/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();

        // Seed has 10 entries, 1 trashed (e-009) → 9 non-trashed minimum
        // Other tests may create additional entries, so use GreaterOrEqualTo
        var total = json.GetProperty("totalEntries").GetInt32();
        total.Should().BeGreaterOrEqualTo(9);

        var published = json.GetProperty("publishedEntries").GetInt32();
        published.Should().BeGreaterOrEqualTo(1);

        var unpublished = json.GetProperty("unpublishedEntries").GetInt32();
        unpublished.Should().BeGreaterOrEqualTo(1);

        // published + unpublished should not exceed total (total may include historical versions)
        (published + unpublished)
            .Should()
            .BeLessThanOrEqualTo(total);

        // Seed has 6 folders minimum
        json.GetProperty("totalFolders").GetInt32().Should().BeGreaterOrEqualTo(6);
    }

    [Fact]
    public async Task GetStats_RecentEntries_AreNonTrashedAndLimited()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/dashboard/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var recentEntries = json.GetProperty("recentEntries").EnumerateArray().ToList();

        // Should return at most 8 entries
        recentEntries.Should().HaveCountLessThanOrEqualTo(8);
        recentEntries.Should().NotBeEmpty();

        // Each entry should have the expected properties
        foreach (var entry in recentEntries)
        {
            entry.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
            entry.GetProperty("title").GetString().Should().NotBeNullOrEmpty();
            entry.GetProperty("versionState").GetString().Should().BeOneOf("tab", "published", "unpublished");
            entry.GetProperty("updatedAt").GetString().Should().NotBeNullOrEmpty();
        }

        // Entries should be ordered by updatedAt descending
        var dates = recentEntries
            .Select(e => DateTime.Parse(e.GetProperty("updatedAt").GetString()!))
            .ToList();
        dates.Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task GetStats_RecentActivity_HasExpectedStructure()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/dashboard/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var activities = json.GetProperty("recentActivity").EnumerateArray().ToList();

        // Should return at most 10 activities
        activities.Should().HaveCountLessThanOrEqualTo(10);

        // Each activity should have the expected properties
        foreach (var activity in activities)
        {
            activity.GetProperty("id").GetString().Should().NotBeNullOrEmpty();
            activity.GetProperty("action").GetString().Should().NotBeNullOrEmpty();
            activity.GetProperty("entityType").GetString().Should().NotBeNullOrEmpty();
            activity.GetProperty("userName").GetString().Should().NotBeNullOrEmpty();
            activity.GetProperty("timestamp").GetString().Should().NotBeNullOrEmpty();
            // details may be null, just verify property exists
            activity.TryGetProperty("details", out _).Should().BeTrue();
        }
    }

    [Fact]
    public async Task GetStats_NoToken_Returns401()
    {
        var response = await Client.GetAsync("/api/dashboard/stats");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetStats_AllRoles_CanAccess()
    {
        // Viewer
        var viewerToken = await AuthHelper.GetViewerTokenAsync(Client);
        Client.WithBearerToken(viewerToken);
        var viewerResponse = await Client.GetAsync("/api/dashboard/stats");
        viewerResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Editor
        var editorToken = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(editorToken);
        var editorResponse = await Client.GetAsync("/api/dashboard/stats");
        editorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Admin
        var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(adminToken);
        var adminResponse = await Client.GetAsync("/api/dashboard/stats");
        adminResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
