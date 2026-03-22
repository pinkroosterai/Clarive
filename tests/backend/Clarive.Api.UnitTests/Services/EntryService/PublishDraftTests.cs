using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class PublishDraftTests : EntryServiceTestBase
{
    [Fact]
    public async Task Publish_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await VersionSut.PublishDraftAsync(TenantId, entryId, UserId, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Publish_NoDraftVersion_ReturnsConflictError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await VersionSut.PublishDraftAsync(
            TenantId,
            entry.Id,
            UserId,
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
        result.FirstError.Code.Should().Be("NO_DRAFT");
    }

    [Fact]
    public async Task Publish_WorkingVersionNotDraft_ReturnsConflictError()
    {
        var entry = MakeEntry();
        var published = MakeVersion(entry.Id, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(published);

        var result = await VersionSut.PublishDraftAsync(
            TenantId,
            entry.Id,
            UserId,
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
        result.FirstError.Code.Should().Be("NO_DRAFT");
    }

    [Fact]
    public async Task Publish_FirstPublish_SetsPublishedState()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, state: VersionState.Draft);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(draft);
        EntryRepo
            .GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null); // no prior published

        var result = await VersionSut.PublishDraftAsync(
            TenantId,
            entry.Id,
            UserId,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        var (_, resultVersion) = result.Value;

        resultVersion.VersionState.Should().Be(VersionState.Published);
        resultVersion.PublishedAt.Should().NotBeNull();
        resultVersion.PublishedBy.Should().Be(UserId);
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).UpdateVersionAsync(draft, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Publish_Republish_MovesOldPublishedToHistorical()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, version: 2, state: VersionState.Draft);
        var oldPublished = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(draft);
        EntryRepo
            .GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(oldPublished);

        var result = await VersionSut.PublishDraftAsync(
            TenantId,
            entry.Id,
            UserId,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        oldPublished.VersionState.Should().Be(VersionState.Historical);
        await EntryRepo.Received(1).UpdateVersionAsync(oldPublished, Arg.Any<CancellationToken>());
        draft.VersionState.Should().Be(VersionState.Published);
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).UpdateVersionAsync(draft, Arg.Any<CancellationToken>());
    }
}
