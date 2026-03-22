using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.BackgroundJobs;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class HistoryCleanupJobTests
{
    private readonly IJobExecutionHistoryRepository _repo = Substitute.For<IJobExecutionHistoryRepository>();
    private readonly ILogger<HistoryCleanupJob> _logger = Substitute.For<ILogger<HistoryCleanupJob>>();
    private readonly IJobExecutionContext _context = Substitute.For<IJobExecutionContext>();
    private readonly HistoryCleanupJob _sut;

    public HistoryCleanupJobTests()
    {
        _context.CancellationToken.Returns(CancellationToken.None);
        _sut = new HistoryCleanupJob(_repo, _logger);
    }

    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(HistoryCleanupJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty();
    }

    [Fact]
    public void Job_ImplementsIJob()
    {
        typeof(HistoryCleanupJob).Should().Implement<IJob>();
    }

    [Fact]
    public async Task Execute_CallsPurgeWithCorrect90DayCutoff()
    {
        var before = DateTime.UtcNow.AddDays(-90);

        await _sut.Execute(_context);

        var after = DateTime.UtcNow.AddDays(-90);

        await _repo.Received(1).PurgeOlderThanAsync(
            Arg.Is<DateTime>(d => d >= before && d <= after),
            Arg.Any<CancellationToken>());
    }
}
