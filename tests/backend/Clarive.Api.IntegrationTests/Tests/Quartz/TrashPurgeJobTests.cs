using Clarive.Api.IntegrationTests.Fixtures;
using Clarive.Api.IntegrationTests.Helpers;
using Clarive.Api.Seed;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Quartz;

[Collection("Integration")]
public class TrashPurgeJobTests : IntegrationTestBase
{
    public TrashPurgeJobTests(IntegrationTestFixture fixture)
        : base(fixture) { }

    private async Task<Guid> SeedTrashedEntryAsync(DateTime? trashedAt)
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();

        var entry = new PromptEntry
        {
            Id = Guid.NewGuid(),
            TenantId = SeedData.TenantId,
            Title = $"Trash-test-{Guid.NewGuid():N}",
            IsTrashed = true,
            TrashedAt = trashedAt,
            CreatedBy = SeedData.AdminUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.PromptEntries.Add(entry);

        // Add a Main tab version so the entry is well-formed
        var version = new PromptEntryVersion
        {
            Id = Guid.NewGuid(),
            EntryId = entry.Id,
            TabName = "Main",
            IsMainTab = true,
            VersionState = VersionState.Tab,
            CreatedAt = DateTime.UtcNow,
            Prompts =
            [
                new Prompt
                {
                    Id = Guid.NewGuid(),
                    Content = "test",
                    Order = 0,
                },
            ],
        };
        db.PromptEntryVersions.Add(version);

        await db.SaveChangesAsync();
        return entry.Id;
    }

    private async Task<bool> EntryExistsAsync(Guid entryId)
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        return await db.PromptEntries.IgnoreQueryFilters().AnyAsync(e => e.Id == entryId);
    }

    private async Task CleanupEntryAsync(Guid entryId)
    {
        using var scope = Fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
        var entry = await db
            .PromptEntries.IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == entryId);
        if (entry is not null)
        {
            db.PromptEntries.Remove(entry);
            await db.SaveChangesAsync();
        }
    }

    private async Task TriggerTrashPurgeJobAsync()
    {
        var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
        var scheduler = await schedulerFactory.GetScheduler();
        await scheduler.TriggerJob(new JobKey("TrashPurge", "Application"));
        await Task.Delay(3000); // Wait for job to complete
    }

    [Fact]
    public async Task Execute_PurgesExpiredEntries_PreservesRecentAndNullTrashedAt()
    {
        // Seed three entries:
        // 1) Trashed 31 days ago → should be purged
        // 2) Trashed 5 days ago → should survive
        // 3) Trashed with NULL TrashedAt (pre-migration) → should survive
        var expiredId = await SeedTrashedEntryAsync(DateTime.UtcNow.AddDays(-31));
        var recentId = await SeedTrashedEntryAsync(DateTime.UtcNow.AddDays(-5));
        var nullTrashedAtId = await SeedTrashedEntryAsync(null);

        try
        {
            await TriggerTrashPurgeJobAsync();

            var expiredExists = await EntryExistsAsync(expiredId);
            var recentExists = await EntryExistsAsync(recentId);
            var nullExists = await EntryExistsAsync(nullTrashedAtId);

            expiredExists.Should().BeFalse("entry trashed 31 days ago should be auto-purged");
            recentExists.Should().BeTrue("entry trashed 5 days ago should be preserved");
            nullExists.Should().BeTrue("entry with NULL TrashedAt should never be auto-purged");
        }
        finally
        {
            await CleanupEntryAsync(expiredId);
            await CleanupEntryAsync(recentId);
            await CleanupEntryAsync(nullTrashedAtId);
        }
    }

    [Fact]
    public async Task Trash_SetsTrashedAt_Restore_ClearsTrashedAt()
    {
        var token = await AuthHelper.GetEditorTokenAsync(Client);
        Client.WithBearerToken(token);

        // Create a fresh entry
        var (_, created) = await Client.PostJsonAsync<System.Text.Json.JsonElement>(
            "/api/entries",
            new
            {
                title = TestData.UniqueEntryTitle(),
                prompts = new[] { new { content = "TrashedAt lifecycle test" } },
            }
        );
        var entryId = Guid.Parse(created.GetProperty("id").GetString()!);

        try
        {
            // Trash it
            await Client.PostAsync($"/api/entries/{entryId}/trash", null);

            // Verify TrashedAt is set
            using (var scope = Fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
                var entry = await db
                    .PromptEntries.IgnoreQueryFilters()
                    .FirstAsync(e => e.Id == entryId);
                entry.TrashedAt.Should().NotBeNull("TrashedAt should be set after trashing");
                entry.TrashedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(10));
            }

            // Restore it
            await Client.PostAsync($"/api/entries/{entryId}/restore", null);

            // Verify TrashedAt is cleared
            using (var scope = Fixture.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ClariveDbContext>();
                var entry = await db.PromptEntries.FirstAsync(e => e.Id == entryId);
                entry.TrashedAt.Should().BeNull("TrashedAt should be null after restoring");
            }
        }
        finally
        {
            // Clean up — trash then permanent delete
            await Client.PostAsync($"/api/entries/{entryId}/trash", null);
            var adminToken = await AuthHelper.GetAdminTokenAsync(Client);
            Client.WithBearerToken(adminToken);
            await Client.DeleteAsync($"/api/entries/{entryId}/permanent-delete");
        }
    }
}
