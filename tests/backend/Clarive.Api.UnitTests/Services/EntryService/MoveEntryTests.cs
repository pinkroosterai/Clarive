using Clarive.Domain.Entities;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class MoveEntryTests : EntryServiceTestBase
{
    [Fact]
    public async Task Move_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.MoveEntryAsync(TenantId, entryId, null, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Move_TargetFolderNotFound_ReturnsNotFoundError()
    {
        var entry = MakeEntry();
        var targetFolderId = Guid.NewGuid();

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        FolderRepo
            .GetByIdAsync(TenantId, targetFolderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var result = await Sut.MoveEntryAsync(
            TenantId,
            entry.Id,
            targetFolderId,
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Move_ToRoot_ClearsFolderIdAndCallsUpdate()
    {
        var entry = MakeEntry(folderId: Guid.NewGuid());
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.MoveEntryAsync(TenantId, entry.Id, null, CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.FolderId.Should().BeNull();
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Move_ToFolder_SetsFolderIdAndCallsUpdate()
    {
        var entry = MakeEntry();
        var folder = MakeFolder();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        FolderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);

        var result = await Sut.MoveEntryAsync(
            TenantId,
            entry.Id,
            folder.Id,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        result.Value.FolderId.Should().Be(folder.Id);
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }
}
