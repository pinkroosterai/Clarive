using FluentAssertions;
using NSubstitute;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class PublishDraftTests : EntryServiceTestBase
{
    [Fact]
    public async Task Publish_EntryNotFound_ThrowsKeyNotFound()
    {
        var entryId = Guid.NewGuid();
        EntryRepo.GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var act = () => Sut.PublishDraftAsync(TenantId, entryId, UserId, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Publish_NoDraftVersion_ThrowsInvalidOperation()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var act = () => Sut.PublishDraftAsync(TenantId, entry.Id, UserId, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public async Task Publish_WorkingVersionNotDraft_ThrowsInvalidOperation()
    {
        var entry = MakeEntry();
        var published = MakeVersion(entry.Id, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(published);

        var act = () => Sut.PublishDraftAsync(TenantId, entry.Id, UserId, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public async Task Publish_FirstPublish_SetsPublishedState()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, state: VersionState.Draft);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(draft);
        EntryRepo.GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null); // no prior published

        var (_, resultVersion) = await Sut.PublishDraftAsync(
            TenantId, entry.Id, UserId, CancellationToken.None);

        resultVersion.VersionState.Should().Be(VersionState.Published);
        resultVersion.PublishedAt.Should().NotBeNull();
        resultVersion.PublishedBy.Should().Be(UserId);
    }

    [Fact]
    public async Task Publish_Republish_MovesOldPublishedToHistorical()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, version: 2, state: VersionState.Draft);
        var oldPublished = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(draft);
        EntryRepo.GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(oldPublished);

        await Sut.PublishDraftAsync(TenantId, entry.Id, UserId, CancellationToken.None);

        oldPublished.VersionState.Should().Be(VersionState.Historical);
        await EntryRepo.Received(1).UpdateVersionAsync(oldPublished, Arg.Any<CancellationToken>());
        draft.VersionState.Should().Be(VersionState.Published);
    }
}
