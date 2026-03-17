using System.Net;
using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Super;

[Collection("Integration")]
public class SystemLogTests : IntegrationTestBase
{
    private const string LogsUrl = "/api/super/system-logs";

    public SystemLogTests(IntegrationTestFixture fixture) : base(fixture) { }

    private async Task EnsureLogsTableExistsAsync(NpgsqlDataSource ds)
    {
        await using var conn = await ds.OpenConnectionAsync();

        // Drop and recreate to ensure schema matches (Serilog may have auto-created without id column)
        await using var dropCmd = conn.CreateCommand();
        dropCmd.CommandText = "DROP TABLE IF EXISTS logs";
        await dropCmd.ExecuteNonQueryAsync();

        await using var createCmd = conn.CreateCommand();
        createCmd.CommandText = """
            CREATE TABLE logs (
                id BIGSERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                level INTEGER NOT NULL DEFAULT 2,
                message TEXT,
                message_template TEXT,
                exception TEXT,
                properties JSONB
            )
            """;
        await createCmd.ExecuteNonQueryAsync();
    }

    private async Task SeedLogsAsync(NpgsqlDataSource ds, int count, int level = 2, string? message = null, DateTime? timestamp = null)
    {
        await using var conn = await ds.OpenConnectionAsync();
        for (var i = 0; i < count; i++)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO logs (timestamp, level, message, message_template, exception, properties)
                VALUES (@ts, @lvl, @msg, @tmpl, @exc, @props::jsonb)
                """;
            cmd.Parameters.AddWithValue("@ts", (timestamp ?? DateTime.UtcNow).AddMinutes(-i));
            cmd.Parameters.AddWithValue("@lvl", level);
            cmd.Parameters.AddWithValue("@msg", message ?? $"Test log message {i}");
            cmd.Parameters.AddWithValue("@tmpl", "Test log message {Index}");
            cmd.Parameters.AddWithValue("@exc", level >= 4 ? (object)"System.Exception: test\n  at Test.Method()" : DBNull.Value);
            cmd.Parameters.AddWithValue("@props", $"{{\"SourceContext\":\"Clarive.Api.TestSource\",\"Index\":{i}}}");
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private async Task CleanupLogsAsync(NpgsqlDataSource ds)
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM logs";
        await cmd.ExecuteNonQueryAsync();
    }

    // ── Authorization ──

    [Fact]
    public async Task GetLogs_RegularUser_Returns403()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(LogsUrl);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetLogs_SuperAdmin_Returns200()
    {
        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(LogsUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Pagination ──

    [Fact]
    public async Task GetLogs_ReturnsPaginatedResults()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);
        await SeedLogsAsync(ds, 10);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{LogsUrl}?page=1&pageSize=3");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("items").GetArrayLength().Should().Be(3);
        json.GetProperty("totalCount").GetInt64().Should().Be(10);
        json.GetProperty("page").GetInt32().Should().Be(1);
        json.GetProperty("pageSize").GetInt32().Should().Be(3);
    }

    // ── Level Filtering ──

    [Fact]
    public async Task GetLogs_FiltersByLevel()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);
        await SeedLogsAsync(ds, 3, level: 4); // Error
        await SeedLogsAsync(ds, 5, level: 2); // Information

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{LogsUrl}?levels=Error");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totalCount").GetInt64().Should().Be(3);
    }

    [Fact]
    public async Task GetLogs_FiltersByMultipleLevels()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);
        await SeedLogsAsync(ds, 3, level: 4); // Error
        await SeedLogsAsync(ds, 2, level: 3); // Warning
        await SeedLogsAsync(ds, 5, level: 2); // Information

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{LogsUrl}?levels=Error,Warning");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totalCount").GetInt64().Should().Be(5);
    }

    // ── Text Search ──

    [Fact]
    public async Task GetLogs_SearchMatchesMessage()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);
        await SeedLogsAsync(ds, 3, message: "Database connection failed");
        await SeedLogsAsync(ds, 5, message: "Request completed successfully");

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{LogsUrl}?search=Database");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totalCount").GetInt64().Should().Be(3);
    }

    // ── Date Range ──

    [Fact]
    public async Task GetLogs_FiltersByDateRange()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);

        var now = DateTime.UtcNow;
        await SeedLogsAsync(ds, 3, timestamp: now);
        await SeedLogsAsync(ds, 2, timestamp: now.AddDays(-10));

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var dateFrom = now.AddDays(-1).ToString("O");
        var response = await Client.GetAsync($"{LogsUrl}?dateFrom={dateFrom}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        json.GetProperty("totalCount").GetInt64().Should().Be(3);
    }

    // ── Sorting ──

    [Fact]
    public async Task GetLogs_SortsByTimestampAscending()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);
        await SeedLogsAsync(ds, 3);

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync($"{LogsUrl}?sortBy=timestamp&sortDesc=false");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var items = json.GetProperty("items");
        items.GetArrayLength().Should().Be(3);

        var first = DateTime.Parse(items[0].GetProperty("timestamp").GetString()!);
        var last = DateTime.Parse(items[2].GetProperty("timestamp").GetString()!);
        first.Should().BeBefore(last);
    }

    // ── Detail fields ──

    [Fact]
    public async Task GetLogs_ReturnsExceptionAndProperties()
    {
        using var scope = Fixture.Services.CreateScope();
        var ds = scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
        await EnsureLogsTableExistsAsync(ds);
        await CleanupLogsAsync(ds);
        await SeedLogsAsync(ds, 1, level: 4); // Error with exception

        var token = await AuthHelper.GetAdminTokenAsync(Client);
        Client.WithBearerToken(token);

        var response = await Client.GetAsync(LogsUrl);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.ReadJsonAsync();
        var item = json.GetProperty("items")[0];
        item.GetProperty("level").GetString().Should().Be("Error");
        item.GetProperty("exception").GetString().Should().Contain("System.Exception");
        item.GetProperty("sourceContext").GetString().Should().Be("Clarive.Api.TestSource");
        item.GetProperty("properties").GetString().Should().Contain("SourceContext");
    }
}
