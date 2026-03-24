using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
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
    public async Task Update_MainTabNotFound_ReturnsNotFoundError()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetMainTabAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
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
    public async Task Update_Tab_UpdatesInPlace()
    {
        var entry = MakeEntry();
        var tab = MakeVersion(entry.Id, version: 0, state: VersionState.Tab);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetMainTabAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns(tab);

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
        resultVersion.VersionState.Should().Be(VersionState.Tab);

        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).UpdateVersionAsync(tab, Arg.Any<CancellationToken>());
        // No new version created — tabs are updated in place
        await EntryRepo
            .DidNotReceive()
            .CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_WithTabId_UpdatesSpecificTab()
    {
        var entry = MakeEntry();
        var specificTab = MakeVersion(entry.Id, version: 0, state: VersionState.Tab);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo
            .GetVersionByIdAsync(TenantId, specificTab.Id, Arg.Any<CancellationToken>())
            .Returns(specificTab);

        var request = new UpdateEntryRequest("Title", "Updated system", null, TabId: specificTab.Id);

        var result = await Sut.UpdateEntryAsync(
            TenantId,
            entry.Id,
            request,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        result.Value.WorkingVersion.SystemMessage.Should().Be("Updated system");
    }
}
