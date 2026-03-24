using Clarive.AI.Orchestration;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Application.TestDatasets.Contracts;
using Clarive.Application.TestDatasets.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class TestDatasetServiceTests
{
    private readonly ITestDatasetRepository _datasetRepo = Substitute.For<ITestDatasetRepository>();
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly IPromptOrchestrator _orchestrator = Substitute.For<IPromptOrchestrator>();
    private readonly ILogger<TestDatasetService> _logger = Substitute.For<ILogger<TestDatasetService>>();
    private readonly TestDatasetService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid EntryId = Guid.NewGuid();

    public TestDatasetServiceTests()
    {
        _sut = new TestDatasetService(_datasetRepo, _entryRepo, _orchestrator, _logger);
    }

    [Fact]
    public async Task CreateAsync_EmptyName_ReturnsValidationError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTestDatasetRequest(""));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateAsync_NameTooLong_ReturnsValidationError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });

        var longName = new string('x', 101);
        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTestDatasetRequest(longName));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateAsync_EntryNotFound_ReturnsNotFoundError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTestDatasetRequest("Valid Name"));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task CreateAsync_ExceedsLimit_ReturnsLimitError()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });
        _datasetRepo.GetCountByEntryIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(20);

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTestDatasetRequest("One Too Many"));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TEST_DATASET_LIMIT_EXCEEDED");
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_Succeeds()
    {
        _entryRepo.GetByIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(new PromptEntry { Id = EntryId, TenantId = TenantId, Title = "Test" });
        _datasetRepo.GetCountByEntryIdAsync(TenantId, EntryId, Arg.Any<CancellationToken>())
            .Returns(0);
        _datasetRepo.CreateAsync(Arg.Any<TestDataset>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<TestDataset>());

        var result = await _sut.CreateAsync(TenantId, EntryId, new CreateTestDatasetRequest("My Dataset"));

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("My Dataset");
        result.Value.Rows.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAsync_DatasetNotFound_ReturnsNotFoundError()
    {
        var datasetId = Guid.NewGuid();
        _datasetRepo.GetByIdAsync(TenantId, datasetId, Arg.Any<CancellationToken>())
            .Returns((TestDataset?)null);

        var result = await _sut.GetAsync(TenantId, EntryId, datasetId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TEST_DATASET_NOT_FOUND");
    }

    [Fact]
    public async Task DeleteAsync_DatasetNotFound_ReturnsNotFoundError()
    {
        var datasetId = Guid.NewGuid();
        _datasetRepo.DeleteAsync(TenantId, datasetId, Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await _sut.DeleteAsync(TenantId, EntryId, datasetId);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TEST_DATASET_NOT_FOUND");
    }

    [Fact]
    public async Task AddRowAsync_DatasetNotFound_ReturnsNotFoundError()
    {
        var datasetId = Guid.NewGuid();
        _datasetRepo.GetByIdAsync(TenantId, datasetId, Arg.Any<CancellationToken>())
            .Returns((TestDataset?)null);

        var result = await _sut.AddRowAsync(
            TenantId, EntryId, datasetId,
            new AddTestDatasetRowRequest(new Dictionary<string, string> { ["topic"] = "test" }));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TEST_DATASET_NOT_FOUND");
    }

    [Fact]
    public async Task AddRowAsync_ValidValues_Succeeds()
    {
        var datasetId = Guid.NewGuid();
        _datasetRepo.GetByIdAsync(TenantId, datasetId, Arg.Any<CancellationToken>())
            .Returns(new TestDataset { Id = datasetId, TenantId = TenantId, EntryId = EntryId, Name = "Test", Rows = [] });
        _datasetRepo.AddRowAsync(Arg.Any<TestDatasetRow>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<TestDatasetRow>());

        var values = new Dictionary<string, string> { ["topic"] = "AI", ["audience"] = "devs" };
        var result = await _sut.AddRowAsync(TenantId, EntryId, datasetId, new AddTestDatasetRowRequest(values));

        result.IsError.Should().BeFalse();
        result.Value.Values.Should().ContainKey("topic").WhoseValue.Should().Be("AI");
    }

    [Fact]
    public async Task UpdateRowAsync_RowNotFound_ReturnsNotFoundError()
    {
        var datasetId = Guid.NewGuid();
        var rowId = Guid.NewGuid();
        _datasetRepo.GetByIdAsync(TenantId, datasetId, Arg.Any<CancellationToken>())
            .Returns(new TestDataset { Id = datasetId, TenantId = TenantId, EntryId = EntryId, Name = "Test", Rows = [] });

        var result = await _sut.UpdateRowAsync(
            TenantId, EntryId, datasetId, rowId,
            new UpdateTestDatasetRowRequest(new Dictionary<string, string> { ["topic"] = "updated" }));

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TEST_DATASET_ROW_NOT_FOUND");
    }
}
