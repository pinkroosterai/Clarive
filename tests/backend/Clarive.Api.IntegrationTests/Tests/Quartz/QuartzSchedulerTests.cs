using Clarive.Api.IntegrationTests.Fixtures;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Quartz.Impl.Matchers;
using Xunit;

namespace Clarive.Api.IntegrationTests.Tests.Quartz;

[Collection("Integration")]
public class QuartzSchedulerTests : IntegrationTestBase
{
    public QuartzSchedulerTests(IntegrationTestFixture fixture) : base(fixture) { }

    [Fact]
    public async Task Scheduler_IsRunning()
    {
        var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
        var scheduler = await schedulerFactory.GetScheduler();

        scheduler.Should().NotBeNull();
        scheduler.IsStarted.Should().BeTrue("Quartz scheduler should be running after app startup");
    }

    [Fact]
    public async Task Scheduler_HasAll8JobsRegistered()
    {
        var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
        var scheduler = await schedulerFactory.GetScheduler();

        var jobKeys = await scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup());
        jobKeys.Should().HaveCount(11, "all 11 background jobs should be registered");

        var jobNames = jobKeys.Select(k => k.Name).OrderBy(n => n).ToList();
        jobNames.Should().Contain("TokenCleanup");
        jobNames.Should().Contain("AiSessionCleanup");
        jobNames.Should().Contain("AiUsageCleanup");
        jobNames.Should().Contain("LogCleanup");
        jobNames.Should().Contain("AuditLogCleanup");
        jobNames.Should().Contain("AccountPurge");
        jobNames.Should().Contain("MaintenanceSync");
        jobNames.Should().Contain("LiteLlmSync");
        jobNames.Should().Contain("McpSync");
    }

    [Fact]
    public async Task Scheduler_InfrastructureJobs_HaveCorrectGroup()
    {
        var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
        var scheduler = await schedulerFactory.GetScheduler();

        var infraJobs = await scheduler.GetJobKeys(GroupMatcher<JobKey>.GroupEquals("Infrastructure"));
        infraJobs.Should().HaveCount(6);

        var names = infraJobs.Select(k => k.Name).OrderBy(n => n).ToList();
        names.Should().BeEquivalentTo(["AiSessionCleanup", "AiUsageCleanup", "AuditLogCleanup", "HistoryCleanup", "LogCleanup", "TokenCleanup"]);
    }

    [Fact]
    public async Task Scheduler_ApplicationJobs_HaveCorrectGroup()
    {
        var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
        var scheduler = await schedulerFactory.GetScheduler();

        var appJobs = await scheduler.GetJobKeys(GroupMatcher<JobKey>.GroupEquals("Application"));
        appJobs.Should().HaveCount(5);

        var names = appJobs.Select(k => k.Name).OrderBy(n => n).ToList();
        names.Should().BeEquivalentTo(["AccountPurge", "LiteLlmSync", "MaintenanceSync", "McpSync", "TrashPurge"]);
    }

    [Fact]
    public async Task Scheduler_AllJobsHaveCronTriggers()
    {
        var schedulerFactory = Fixture.Services.GetRequiredService<ISchedulerFactory>();
        var scheduler = await schedulerFactory.GetScheduler();

        var jobKeys = await scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup());

        foreach (var jobKey in jobKeys)
        {
            var triggers = await scheduler.GetTriggersOfJob(jobKey);
            triggers.Should().NotBeEmpty($"job '{jobKey.Name}' should have at least one trigger");

            var hasCronTrigger = triggers.Any(t => t is ICronTrigger);
            hasCronTrigger.Should().BeTrue($"job '{jobKey.Name}' should have a cron trigger");
        }
    }

    [Fact]
    public async Task Scheduler_QuartzTablesExist()
    {
        using var scope = Fixture.Services.CreateScope();
        var dataSource = scope.ServiceProvider.GetRequiredService<Npgsql.NpgsqlDataSource>();

        await using var conn = await dataSource.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'qrtz_%'";
        var count = (long)(await cmd.ExecuteScalarAsync())!;

        count.Should().BeGreaterOrEqualTo(11, "all 11 qrtz_ tables should exist after migration");
    }
}
