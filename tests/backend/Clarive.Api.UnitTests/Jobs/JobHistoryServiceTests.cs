using Clarive.Application.SuperAdmin.Services;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Jobs;

public class JobHistoryServiceTests
{
    private readonly IJobExecutionHistoryRepository _repo = Substitute.For<IJobExecutionHistoryRepository>();
    private readonly JobHistoryService _sut;

    public JobHistoryServiceTests()
    {
        _sut = new JobHistoryService(_repo);
    }

    [Theory]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData(null)]
    public async Task GetHistoryByJob_EmptyJobName_ReturnsValidationError(string? jobName)
    {
        var result = await _sut.GetHistoryByJobAsync(jobName!, 1, 20);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_JOB_NAME");
    }

    [Fact]
    public async Task GetHistoryByJob_InvalidPage_ReturnsValidationError()
    {
        var result = await _sut.GetHistoryByJobAsync("TokenCleanup", 0, 20);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_PAGE");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(201)]
    public async Task GetHistoryByJob_InvalidPageSize_ReturnsValidationError(int pageSize)
    {
        var result = await _sut.GetHistoryByJobAsync("TokenCleanup", 1, pageSize);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_PAGE_SIZE");
    }

    [Fact]
    public async Task GetHistoryByJob_ValidRequest_ReturnsResults()
    {
        var items = new List<JobExecutionHistory>
        {
            new() { Id = Guid.NewGuid(), JobName = "TokenCleanup", Succeeded = true }
        };
        _repo.GetByJobNameAsync("TokenCleanup", 1, 20, Arg.Any<CancellationToken>())
            .Returns((items, 1));

        var result = await _sut.GetHistoryByJobAsync("TokenCleanup", 1, 20);

        result.IsError.Should().BeFalse();
        result.Value.Items.Should().HaveCount(1);
        result.Value.Total.Should().Be(1);
    }

    [Fact]
    public async Task GetRecentFailures_InvalidCount_ReturnsValidationError()
    {
        var result = await _sut.GetRecentFailuresAsync(0);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_COUNT");
    }

    [Fact]
    public async Task GetRecentFailures_CountTooHigh_ReturnsValidationError()
    {
        var result = await _sut.GetRecentFailuresAsync(101);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("INVALID_COUNT");
    }

    [Fact]
    public async Task GetRecentFailures_ValidCount_ReturnsResults()
    {
        var failures = new List<JobExecutionHistory>
        {
            new() { Id = Guid.NewGuid(), JobName = "FailJob", Succeeded = false }
        };
        _repo.GetRecentFailuresAsync(10, Arg.Any<CancellationToken>()).Returns(failures);

        var result = await _sut.GetRecentFailuresAsync(10);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(1);
    }
}
