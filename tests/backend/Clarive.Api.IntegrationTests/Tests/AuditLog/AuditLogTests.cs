using System.Net;
using System.Text.Json;
using FluentAssertions;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.AuditLog;

[Collection("Integration")]
public class AuditLogTests : IntegrationTestBase
{
    public AuditLogTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task GetPage_AsAdmin_ReturnsPaginatedLogs()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/audit-log?page=1&pageSize=5");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();

        json.GetProperty("total").GetInt32().Should().BeGreaterOrEqualTo(1);
        json.GetProperty("page").GetInt32().Should().Be(1);
        json.GetProperty("pageSize").GetInt32().Should().Be(5);

        var entries = json.GetProperty("entries").EnumerateArray().ToList();
        entries.Should().NotBeEmpty();
        entries.Count.Should().BeLessThanOrEqualTo(5);

        // Verify entry structure
        var entry = entries[0];
        entry.GetProperty("action").GetString().Should().NotBeNullOrEmpty();
        entry.GetProperty("entityType").GetString().Should().NotBeNullOrEmpty();
        entry.GetProperty("userName").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetPage_NoToken_Returns401()
    {
        var response = await Client.GetAsync("/api/audit-log");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPage_DefaultPagination_Returns20PerPage()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/audit-log");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("pageSize").GetInt32().Should().Be(20);
    }

    [Fact]
    public async Task GetPage_LargePageSize_CapsAt100()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/audit-log?pageSize=999");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.ReadJsonAsync();
        json.GetProperty("pageSize").GetInt32().Should().Be(100);
    }
}
