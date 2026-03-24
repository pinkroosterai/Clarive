using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class PublishTabTests : EntryServiceTestBase
{
    [Fact]
    public async Task PublishTab_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await VersionSut.PublishTabAsync(TenantId, entryId, Guid.NewGuid(), UserId, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task PublishTab_TabNotFound_ReturnsError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await VersionSut.PublishTabAsync(TenantId, entry.Id, Guid.NewGuid(), UserId, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("TAB_NOT_FOUND");
    }

    [Fact]
    public async Task PublishTab_FirstPublish_CreatesPublishedSnapshot()
    {
        var entry = MakeEntry();
        var tab = MakeVersion(entry.Id, version: 0, state: VersionState.Tab);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionByIdAsync(TenantId, tab.Id, Arg.Any<CancellationToken>()).Returns(tab);
        EntryRepo.GetMaxVersionNumberAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(0);
        EntryRepo.GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await VersionSut.PublishTabAsync(TenantId, entry.Id, tab.Id, UserId, CancellationToken.None);

        result.IsError.Should().BeFalse();
        var (_, snapshot) = result.Value;
        snapshot.VersionState.Should().Be(VersionState.Published);
        snapshot.Version.Should().Be(1);
        snapshot.PublishedAt.Should().NotBeNull();
        snapshot.PublishedBy.Should().Be(UserId);

        // Tab should NOT be modified — snapshot is a separate row
        tab.VersionState.Should().Be(VersionState.Tab);
    }

    [Fact]
    public async Task PublishTab_Republish_ArchivesOldPublished()
    {
        var entry = MakeEntry();
        var tab = MakeVersion(entry.Id, version: 0, state: VersionState.Tab);
        var oldPublished = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionByIdAsync(TenantId, tab.Id, Arg.Any<CancellationToken>()).Returns(tab);
        EntryRepo.GetMaxVersionNumberAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(1);
        EntryRepo.GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(oldPublished);

        var result = await VersionSut.PublishTabAsync(TenantId, entry.Id, tab.Id, UserId, CancellationToken.None);

        result.IsError.Should().BeFalse();
        oldPublished.VersionState.Should().Be(VersionState.Historical);
        var (_, snapshot) = result.Value;
        snapshot.Version.Should().Be(2);
    }
}
