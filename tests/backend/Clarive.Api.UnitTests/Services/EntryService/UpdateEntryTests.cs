using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class UpdateEntryTests : EntryServiceTestBase
{
    [Fact]
    public async Task Update_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entryId,
            ValidUpdateRequest(),
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Update_WorkingVersionNotFound_ReturnsNotFoundError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entry.Id,
            ValidUpdateRequest(),
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Update_DraftState_UpdatesInPlace()
    {
        var entry = MakeEntry();
        var draft = MakeVersion(entry.Id, version: 1, state: VersionState.Draft);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(draft);

        var request = new UpdateEntryRequest("New Title", "New system msg", null);

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entry.Id,
            request,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        var (resultEntry, resultVersion) = result.Value;

        resultEntry.Title.Should().Be("New Title");
        resultVersion.SystemMessage.Should().Be("New system msg");
        resultVersion.Version.Should().Be(1); // same version

        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).UpdateVersionAsync(draft, Arg.Any<CancellationToken>());
        await EntryRepo
            .DidNotReceive()
            .CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_PublishedState_CreatesNewDraftVersion()
    {
        var entry = MakeEntry();
        var published = MakeVersion(
            entry.Id,
            version: 1,
            state: VersionState.Published,
            systemMessage: "Original system"
        );

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(published);
        EntryRepo
            .GetMaxVersionNumberAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(1);

        var request = new UpdateEntryRequest(
            "New Title",
            "New system",
            [new PromptInput("Updated prompt")]
        );

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entry.Id,
            request,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        var (_, resultVersion) = result.Value;

        resultVersion.Version.Should().Be(2);
        resultVersion.VersionState.Should().Be(VersionState.Draft);
        resultVersion.SystemMessage.Should().Be("New system");

        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
        await EntryRepo
            .Received(1)
            .CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_PublishedState_PreservesSystemMessageWhenNotProvided()
    {
        var entry = MakeEntry();
        var published = MakeVersion(
            entry.Id,
            version: 1,
            state: VersionState.Published,
            systemMessage: "Keep this"
        );

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(published);
        EntryRepo
            .GetMaxVersionNumberAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(1);

        var request = new UpdateEntryRequest("Title", null, null); // systemMessage = null

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entry.Id,
            request,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        result.Value.WorkingVersion.SystemMessage.Should().Be("Keep this");
    }
}
