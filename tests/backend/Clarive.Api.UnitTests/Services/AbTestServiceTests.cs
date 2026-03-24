using Clarive.Application.AbTests.Contracts;
using Clarive.Application.AbTests.Services;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class AbTestServiceTests
{
    private readonly IAbTestRepository _abTestRepo = Substitute.For<IAbTestRepository>();
    private readonly ITestDatasetRepository _datasetRepo = Substitute.For<ITestDatasetRepository>();
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly IPlaygroundService _playgroundService = Substitute.For<IPlaygroundService>();
    private readonly ILogger<AbTestService> _logger = Substitute.For<ILogger<AbTestService>>();
    private readonly AbTestService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();
    private static readonly Guid DatasetId = Guid.NewGuid();
    private static readonly Guid VersionAId = Guid.NewGuid();
    private static readonly Guid VersionBId = Guid.NewGuid();

    public AbTestServiceTests()
    {
        _sut = new AbTestService(_abTestRepo, _datasetRepo, _entryRepo, _playgroundService, _logger);
    }

    private static StartAbTestRequest ValidRequest() =>
        new(VersionAId: VersionAId, VersionBId: VersionBId, DatasetId: DatasetId, Model: "test-model");

    private static PromptEntryVersion MakeVersion(Guid id, int version, VersionState state = VersionState.Published) =>
        new() { Id = id, EntryId = EntryId, Version = version, VersionState = state, Prompts = [] };

    [Fact]
    public async Task RunAsync_EntryNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.RunAsync(TenantId, UserId, EntryId, ValidRequest());

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task RunAsync_VersionNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });
        _entryRepo.GetVersionByIdAsync(TenantId, VersionAId, Arg.Any<CancellationToken>())
            .Returns(MakeVersion(VersionAId, 1));
        _entryRepo.GetVersionByIdAsync(TenantId, VersionBId, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await _sut.RunAsync(TenantId, UserId, EntryId, ValidRequest());

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("AB_TEST_VERSION_NOT_FOUND");
    }

    [Fact]
    public async Task RunAsync_EmptyDataset_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });
        _entryRepo.GetVersionByIdAsync(TenantId, VersionAId, Arg.Any<CancellationToken>())
            .Returns(MakeVersion(VersionAId, 1));
        _entryRepo.GetVersionByIdAsync(TenantId, VersionBId, Arg.Any<CancellationToken>())
            .Returns(MakeVersion(VersionBId, 2));
        _datasetRepo.GetByIdAsync(TenantId, DatasetId, Arg.Any<CancellationToken>())
            .Returns(new TestDataset { Id = DatasetId, TenantId = TenantId, EntryId = EntryId, Name = "Empty", Rows = [] });

        var result = await _sut.RunAsync(TenantId, UserId, EntryId, ValidRequest());

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("AB_TEST_DATASET_EMPTY");
    }

    [Fact]
    public async Task GetAsync_NotFound_ReturnsError()
    {
        var runId = Guid.NewGuid();
        _abTestRepo.GetByIdAsync(TenantId, runId, Arg.Any<CancellationToken>())
            .Returns((ABTestRun?)null);

        var result = await _sut.GetAsync(TenantId, EntryId, runId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("AB_TEST_NOT_FOUND");
    }

    [Fact]
    public async Task ListAsync_EntryNotFound_ReturnsError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.ListAsync(TenantId, EntryId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task ListAsync_ReturnsCorrectCount()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });
        _abTestRepo.GetByEntryIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new List<ABTestRun>
            {
                new() { Id = Guid.NewGuid(), TenantId = TenantId, EntryId = EntryId, Model = "m1", Status = ABTestStatus.Completed, Results = [] },
                new() { Id = Guid.NewGuid(), TenantId = TenantId, EntryId = EntryId, Model = "m2", Status = ABTestStatus.Failed, Results = [] },
            });

        var result = await _sut.ListAsync(TenantId, EntryId);

        result.IsError.Should().BeFalse();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task DeleteAsync_NotFound_ReturnsError()
    {
        var runId = Guid.NewGuid();
        _abTestRepo.DeleteAsync(TenantId, runId, Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await _sut.DeleteAsync(TenantId, EntryId, runId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("AB_TEST_NOT_FOUND");
    }

    [Fact]
    public async Task ComputeSummary_WithResults_CalculatesCorrectly()
    {
        var results = new List<ABTestResult>
        {
            new()
            {
                Id = Guid.NewGuid(), VersionAAvgScore = 7.0, VersionBAvgScore = 8.0,
                VersionAScores = new() { ["accuracy"] = new() { Score = 7, Feedback = "" } },
                VersionBScores = new() { ["accuracy"] = new() { Score = 8, Feedback = "" } },
            },
            new()
            {
                Id = Guid.NewGuid(), VersionAAvgScore = 6.0, VersionBAvgScore = 9.0,
                VersionAScores = new() { ["accuracy"] = new() { Score = 6, Feedback = "" } },
                VersionBScores = new() { ["accuracy"] = new() { Score = 9, Feedback = "" } },
            },
        };

        var summary = AbTestService.ComputeSummary(results);

        summary.Should().NotBeNull();
        summary!.VersionAAvg.Should().Be(6.5);
        summary.VersionBAvg.Should().Be(8.5);
        summary.VersionBWins.Should().Be(2);
        summary.VersionAWins.Should().Be(0);
        summary.PerDimension.Should().ContainKey("accuracy");
    }

    [Fact]
    public async Task ComputeVersionLabel_ReturnsCorrectLabels()
    {
        var published = new PromptEntryVersion { Version = 3, VersionState = VersionState.Published };
        var historical = new PromptEntryVersion { Version = 2, VersionState = VersionState.Historical };
        var draft = new PromptEntryVersion { Version = 4, VersionState = VersionState.Draft };
        var variant = new PromptEntryVersion { Version = 0, VersionState = VersionState.Variant, VariantName = "concise-style" };

        AbTestService.ComputeVersionLabel(published).Should().Be("v3 (published)");
        AbTestService.ComputeVersionLabel(historical).Should().Be("v2");
        AbTestService.ComputeVersionLabel(draft).Should().Be("Draft");
        AbTestService.ComputeVersionLabel(variant).Should().Be("concise-style");
    }
}
