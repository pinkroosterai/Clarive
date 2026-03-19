using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class DeleteDraftTests : EntryServiceTestBase
{
    [Fact]
    public async Task DeleteDraft_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.DeleteDraftAsync(TenantId, entryId, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task DeleteDraft_NoDraftExists_ReturnsValidationError()
    {
        var entry = MakeEntry();
        var published = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(published);

        var result = await Sut.DeleteDraftAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NO_DRAFT");
    }

    [Fact]
    public async Task DeleteDraft_NoWorkingVersion_ReturnsValidationError()
    {
        var entry = MakeEntry();

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await Sut.DeleteDraftAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NO_DRAFT");
    }

    [Fact]
    public async Task DeleteDraft_DraftIsOnlyVersion_NoPublished_ReturnsValidationError()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, version: 1, state: VersionState.Draft);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(draft);
        EntryRepo
            .GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await Sut.DeleteDraftAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NO_PUBLISHED_VERSION");
    }

    [Fact]
    public async Task DeleteDraft_HappyPath_DeletesDraftAndReturnsEntry()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, version: 2, state: VersionState.Draft);
        var published = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(draft);
        EntryRepo
            .GetPublishedVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(published);

        var result = await Sut.DeleteDraftAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Should().Be(entry);

        await EntryRepo.Received(1).DeleteVersionAsync(draft, Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }
}
