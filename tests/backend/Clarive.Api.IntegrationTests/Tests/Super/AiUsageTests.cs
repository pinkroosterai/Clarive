using System.Net;
using Clarive.Infrastructure.Data;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Api.Seed;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class AiUsageTests : IntegrationTestBase
{
    private const string UsageUrl = "/api/super/ai-usage";
    private const string StatsUrl = "/api/super/ai-usage/stats";

    public AiUsageTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    private async Task SeedUsageLogsAsync(
        int count = 5,
        string model = "gpt-4o",
        AiActionType actionType = AiActionType.PlaygroundTest
    )
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();

        for (var i = 0; i < count; i++)
        {
            db.AiUsageLogs.Add(
                new AiUsageLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = SeedData.TenantId,
                    UserId = SeedData.AdminUserId,
                    ActionType = actionType,
                    Model = model,
                    Provider = "openai",
                    InputTokens = 100 + i * 10,
                    OutputTokens = 50 + i * 5,
                    DurationMs = 500 + i * 100,
                    CreatedAt = DateTime.UtcNow.AddMinutes(-i),
                }
            );
        }

        await db.SaveChangesAsync();
    }

    private async Task CleanupUsageLogsAsync()
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        await db.AiUsageLogs.ExecuteDeleteAsync();
    }

    // ── Authorization ──

    [Fact]
    public async Task GetUsageLogs_RegularUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(UsageUrl);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetUsageStats_RegularUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(StatsUrl);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetUsageLogs_SuperAdmin_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(UsageUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetUsageStats_SuperAdmin_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(StatsUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Pagination ──

    [Fact]
    public async Task GetUsageLogs_ReturnsPaginatedResults()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(10);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{UsageUrl}?page=1&pageSize=3");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("items").GetArrayLength().Should().Be(3);
        json.GetProperty("totalCount").GetInt64().Should().Be(10);
        json.GetProperty("page").GetInt32().Should().Be(1);
        json.GetProperty("pageSize").GetInt32().Should().Be(3);
    }

    // ── Filtering ──

    [Fact]
    public async Task GetUsageLogs_FiltersByModel()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(3, model: "gpt-4o");
        await SeedUsageLogsAsync(2, model: "claude-3");

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{UsageUrl}?model=gpt-4o");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totalCount").GetInt64().Should().Be(3);
    }

    [Fact]
    public async Task GetUsageLogs_FiltersByActionType()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(4, actionType: AiActionType.PlaygroundTest);
        await SeedUsageLogsAsync(2, actionType: AiActionType.Generation);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{UsageUrl}?actionType=Generation");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totalCount").GetInt64().Should().Be(2);
    }

    // ── Multi-value Filters ──

    [Fact]
    public async Task GetUsageStats_MultipleModels_ReturnsUnion()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(3, model: "gpt-4o");
        await SeedUsageLogsAsync(2, model: "claude-3");
        await SeedUsageLogsAsync(1, model: "gemini-pro");

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{StatsUrl}?model=gpt-4o,claude-3");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totals").GetProperty("totalRequests").GetInt64().Should().Be(5);
        json.GetProperty("byModel").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task GetUsageStats_MultipleActionTypes_ReturnsUnion()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(3, actionType: AiActionType.Generation);
        await SeedUsageLogsAsync(2, actionType: AiActionType.PlaygroundTest);
        await SeedUsageLogsAsync(1, actionType: AiActionType.Decomposition);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{StatsUrl}?actionType=Generation,PlaygroundTest");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totals").GetProperty("totalRequests").GetInt64().Should().Be(5);
    }

    [Fact]
    public async Task GetUsageStats_SingleValueBackwardCompat()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(3, model: "gpt-4o");
        await SeedUsageLogsAsync(2, model: "claude-3");

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{StatsUrl}?model=gpt-4o");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totals").GetProperty("totalRequests").GetInt64().Should().Be(3);
    }

    // ── Filters Endpoint ──

    [Fact]
    public async Task GetFilters_ReturnsDistinctValues()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(2, model: "gpt-4o", actionType: AiActionType.Generation);
        await SeedUsageLogsAsync(1, model: "claude-3", actionType: AiActionType.PlaygroundTest);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/ai-usage/filters");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var models = json.GetProperty("models");
        models.GetArrayLength().Should().Be(2);
        models[0].GetProperty("id").GetString().Should().NotBeNullOrEmpty();
        models[0].GetProperty("displayName").GetString().Should().Contain(":");
        json.GetProperty("actionTypes").GetArrayLength().Should().BeGreaterOrEqualTo(6); // all enum values
        json.GetProperty("tenants").GetArrayLength().Should().BeGreaterOrEqualTo(1);
    }

    [Fact]
    public async Task GetFilters_RegularUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync("/api/super/ai-usage/filters");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Stats ──

    [Fact]
    public async Task GetUsageStats_ReturnsCorrectAggregations()
    {
        await CleanupUsageLogsAsync();
        await SeedUsageLogsAsync(5, model: "gpt-4o", actionType: AiActionType.PlaygroundTest);
        await SeedUsageLogsAsync(3, model: "claude-3", actionType: AiActionType.Generation);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(StatsUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();

        // Totals
        var totals = json.GetProperty("totals");
        totals.GetProperty("totalRequests").GetInt64().Should().Be(8);
        totals.GetProperty("totalInputTokens").GetInt64().Should().BeGreaterThan(0);
        totals.GetProperty("totalOutputTokens").GetInt64().Should().BeGreaterThan(0);

        // Averages
        var averages = json.GetProperty("averages");
        averages.GetProperty("avgTotalTokensPerRequest").GetDouble().Should().BeGreaterThan(0);

        // Breakdowns — byModel uses Provider:Model format
        json.GetProperty("byModel").GetArrayLength().Should().Be(2);
        var firstModel = json.GetProperty("byModel")[0];
        firstModel.GetProperty("name").GetString().Should().Contain(":");
        json.GetProperty("byActionType").GetArrayLength().Should().Be(2);
        json.GetProperty("byTenant").GetArrayLength().Should().BeGreaterOrEqualTo(1);
        json.GetProperty("byUser").GetArrayLength().Should().BeGreaterOrEqualTo(1);
    }
}
