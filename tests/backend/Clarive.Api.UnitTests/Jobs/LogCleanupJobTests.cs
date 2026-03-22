using Clarive.Infrastructure.BackgroundJobs;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Quartz;

namespace Clarive.Api.UnitTests.Jobs;

public class LogCleanupJobTests
{
    [Fact]
    public void Job_HasDisallowConcurrentExecutionAttribute()
    {
        typeof(LogCleanupJob)
            .GetCustomAttributes(typeof(DisallowConcurrentExecutionAttribute), true)
            .Should()
            .NotBeEmpty("cleanup jobs should not run concurrently");
    }

    [Fact]
    public void Job_ImplementsIJob()
    {
        typeof(LogCleanupJob).Should().Implement<IJob>();
    }
}
