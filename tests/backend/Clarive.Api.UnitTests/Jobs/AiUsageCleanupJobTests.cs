using Clarive.Infrastructure.BackgroundJobs;
using Clarive.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class AiUsageCleanupJobTests
{
    private readonly ILogger<AiUsageCleanupJob> _logger = Substitute.For<ILogger<AiUsageCleanupJob>>();

    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(AiUsageCleanupJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty("cleanup jobs should not run concurrently");
    }

    [Fact]
    public void Job_ImplementsIJob()
    {
        typeof(AiUsageCleanupJob).Should().Implement<IJob>();
    }

    [Fact]
    public void Job_CanBeInstantiated()
    {
        var options = new DbContextOptionsBuilder<ClariveDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        using var db = new ClariveDbContext(options);

        var job = new AiUsageCleanupJob(db, _logger);
        job.Should().NotBeNull();
    }
}
