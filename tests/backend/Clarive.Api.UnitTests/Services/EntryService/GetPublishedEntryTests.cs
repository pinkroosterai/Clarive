using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class GetPublishedEntryTests : EntryServiceTestBase
{
    [Fact]
    public async Task GetPublishedEntryAsync_Success_ReturnsEntryAndVersion()
    {
        var entry = MakeEntry();
        var version = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(version);

        var result = await Sut.GetPublishedEntryAsync(TenantId, entry.Id, default);

        result.IsError.Should().BeFalse();
        result.Value.Entry.Id.Should().Be(entry.Id);
        result.Value.PublishedVersion.Id.Should().Be(version.Id);
    }

    [Fact]
    public async Task GetPublishedEntryAsync_EntryNotFound_ReturnsNotFound()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.GetPublishedEntryAsync(TenantId, entryId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task GetPublishedEntryAsync_EntryTrashed_ReturnsNotFound()
    {
        var entry = MakeEntry(isTrashed: true);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.GetPublishedEntryAsync(TenantId, entry.Id, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("ENTRY_NOT_FOUND");
    }

    [Fact]
    public async Task GetPublishedEntryAsync_NoPublishedVersion_ReturnsNotFound()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await Sut.GetPublishedEntryAsync(TenantId, entry.Id, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NO_PUBLISHED_VERSION");
    }
}
