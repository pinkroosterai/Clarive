using FluentAssertions;
using NSubstitute;
using Clarive.Api.Models.Entities;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class MoveEntryTests : EntryServiceTestBase
{
    [Fact]
    public async Task Move_EntryNotFound_ThrowsKeyNotFound()
    {
        var entryId = Guid.NewGuid();
        EntryRepo.GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var act = () => Sut.MoveEntryAsync(TenantId, entryId, null, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Move_TargetFolderNotFound_ThrowsKeyNotFound()
    {
        var entry = MakeEntry();
        var targetFolderId = Guid.NewGuid();

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        FolderRepo.GetByIdAsync(TenantId, targetFolderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var act = () => Sut.MoveEntryAsync(TenantId, entry.Id, targetFolderId, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*folder*");
    }

    [Fact]
    public async Task Move_ToFolderOrRoot_UpdatesFolderId()
    {
        var entry = MakeEntry(folderId: Guid.NewGuid());
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        // Move to root (null)
        var result = await Sut.MoveEntryAsync(TenantId, entry.Id, null, CancellationToken.None);

        result.FolderId.Should().BeNull();
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }
}
