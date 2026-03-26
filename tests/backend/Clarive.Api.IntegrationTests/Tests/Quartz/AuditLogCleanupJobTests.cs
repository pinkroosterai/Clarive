using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.Seed;
using Clarive.Domain.Enums;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Quartz;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Quartz;

[Collection("Integration")]
public class AuditLogCleanupJobTests : IntegrationTestBase
{
    public AuditLogCleanupJobTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    private async Task<NpgsqlDataSource> GetDataSourceAsync()
    {
        var scope = Fixture.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<NpgsqlDataSource>();
    }

    private async Task SeedAuditLogEntryAsync(NpgsqlDataSource ds, Guid id, DateTime expiresAt)
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO audit_log_entries (id, tenant_id, action, entity_type, entity_id, entity_title, user_id, user_name, timestamp, expires_at)
            VALUES (@id, @tenantId, @action, @entityType, @entityId, @entityTitle, @userId, @userName, @timestamp, @expiresAt)
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@tenantId", SeedData.TenantId);
        cmd.Parameters.AddWithValue("@action", (int)AuditAction.EntryCreated);
        cmd.Parameters.AddWithValue("@entityType", "PromptEntry");
        cmd.Parameters.AddWithValue("@entityId", Guid.NewGuid());
        cmd.Parameters.AddWithValue("@entityTitle", "Test Entry");
        cmd.Parameters.AddWithValue("@userId", SeedData.AdminUserId);
        cmd.Parameters.AddWithValue("@userName", "admin");
        cmd.Parameters.AddWithValue("@timestamp", DateTime.UtcNow);
        cmd.Parameters.AddWithValue("@expiresAt", expiresAt);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task<bool> EntryExistsAsync(NpgsqlDataSource ds, Guid id)
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM audit_log_entries WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        var count = (long)(await cmd.ExecuteScalarAsync())!;
        return count > 0;
    }

    private async Task CleanupTestEntriesAsync(NpgsqlDataSource ds, params Guid[] ids)
    {
        await using var conn = await ds.OpenConnectionAsync();
        foreach (var id in ids)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM audit_log_entries WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", id);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Execute_DeletesExpiredEntries_PreservesNonExpired()
    {
        var ds = await GetDataSourceAsync();

        var expiredId = Guid.NewGuid();
        var nonExpiredId = Guid.NewGuid();

        try
        {
            // Seed: one expired (past), one non-expired (future)
            await SeedAuditLogEntryAsync(ds, expiredId, DateTime.UtcNow.AddDays(-1));
            await SeedAuditLogEntryAsync(ds, nonExpiredId, DateTime.UtcNow.AddDays(7));

            // Run the job directly — trigger via scheduler
            var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
            var scheduler = await schedulerFactory.GetScheduler();
            await scheduler.TriggerJob(new JobKey("AuditLogCleanup", "Infrastructure"));

            // Wait briefly for the job to complete
            await Task.Delay(2000);

            // Assert
            var expiredExists = await EntryExistsAsync(ds, expiredId);
            var nonExpiredExists = await EntryExistsAsync(ds, nonExpiredId);

            expiredExists.Should().BeFalse("expired audit log entry should be deleted");
            nonExpiredExists.Should().BeTrue("non-expired audit log entry should be preserved");
        }
        finally
        {
            await CleanupTestEntriesAsync(ds, expiredId, nonExpiredId);
        }
    }
}
