using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.BackgroundJobs;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class JobExecutionHistoryListenerTests
{
    private readonly IJobExecutionHistoryRepository _repo = Substitute.For<IJobExecutionHistoryRepository>();
    private readonly ILogger<JobExecutionHistoryListener> _logger = Substitute.For<ILogger<JobExecutionHistoryListener>>();
    private readonly JobExecutionHistoryListener _sut;

    public JobExecutionHistoryListenerTests()
    {
        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        var scope = Substitute.For<IServiceScope>();
        var serviceProvider = Substitute.For<IServiceProvider>();

        scopeFactory.CreateScope().Returns(scope);
        scope.ServiceProvider.Returns(serviceProvider);
        serviceProvider.GetService(typeof(IJobExecutionHistoryRepository)).Returns(_repo);

        _repo.AddAsync(Arg.Any<JobExecutionHistory>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<JobExecutionHistory>());

        _sut = new JobExecutionHistoryListener(scopeFactory, _logger);
    }

    [Fact]
    public void Name_ReturnsExpectedValue()
    {
        _sut.Name.Should().Be("JobExecutionHistoryListener");
    }

    [Fact]
    public async Task JobWasExecuted_Success_PersistsRecordWithSucceededTrue()
    {
        var context = CreateJobContext("TestJob", "TestGroup");

        // Simulate JobToBeExecuted setting the start time
        await _sut.JobToBeExecuted(context);

        await _sut.JobWasExecuted(context, null, CancellationToken.None);

        await _repo.Received(1).AddAsync(
            Arg.Is<JobExecutionHistory>(h =>
                h.JobName == "TestJob" &&
                h.JobGroup == "TestGroup" &&
                h.Succeeded &&
                h.ExceptionMessage == null &&
                h.DurationMs >= 0),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task JobWasExecuted_WithException_PersistsRecordWithExceptionDetails()
    {
        var context = CreateJobContext("FailJob", "Infrastructure");
        var innerEx = new InvalidOperationException("Database connection failed");
        var jobEx = new JobExecutionException(innerEx);

        await _sut.JobToBeExecuted(context);
        await _sut.JobWasExecuted(context, jobEx, CancellationToken.None);

        await _repo.Received(1).AddAsync(
            Arg.Is<JobExecutionHistory>(h =>
                h.JobName == "FailJob" &&
                !h.Succeeded &&
                h.ExceptionMessage == "Database connection failed"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task JobExecutionVetoed_PersistsVetoedRecord()
    {
        var context = CreateJobContext("VetoedJob", "Application");

        await _sut.JobExecutionVetoed(context, CancellationToken.None);

        await _repo.Received(1).AddAsync(
            Arg.Is<JobExecutionHistory>(h =>
                h.JobName == "VetoedJob" &&
                !h.Succeeded &&
                h.ExceptionMessage == "Job execution was vetoed" &&
                h.DurationMs == 0),
            Arg.Any<CancellationToken>());
    }

    private static IJobExecutionContext CreateJobContext(string jobName, string jobGroup)
    {
        var context = Substitute.For<IJobExecutionContext>();
        var jobDetail = Substitute.For<IJobDetail>();
        var trigger = Substitute.For<ITrigger>();

        jobDetail.Key.Returns(new JobKey(jobName, jobGroup));
        trigger.Key.Returns(new TriggerKey($"{jobName}-trigger"));
        context.JobDetail.Returns(jobDetail);
        context.Trigger.Returns(trigger);
        context.FireTimeUtc.Returns(DateTimeOffset.UtcNow);
        context.MergedJobDataMap.Returns(new JobDataMap());

        return context;
    }
}
