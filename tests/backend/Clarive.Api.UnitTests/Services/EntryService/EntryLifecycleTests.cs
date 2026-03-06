using FluentAssertions;
using NSubstitute;
using Clarive.Api.Models.Entities;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class EntryLifecycleTests : EntryServiceTestBase
{
    // ── TrashEntryAsync ──────────────────────────────────────────

    [Fact]
    public async Task Trash_EntryNotFound_ThrowsKeyNotFound()
    {
        var entryId = Guid.NewGuid();
        EntryRepo.GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var act = () => Sut.TrashEntryAsync(TenantId, entryId, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Trash_SetsIsTrashedTrue()
    {
        var entry = MakeEntry(isTrashed: false);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.TrashEntryAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsTrashed.Should().BeTrue();
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }

    // ── RestoreEntryAsync ────────────────────────────────────────

    [Fact]
    public async Task Restore_EntryNotFound_ThrowsKeyNotFound()
    {
        var entryId = Guid.NewGuid();
        EntryRepo.GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var act = () => Sut.RestoreEntryAsync(TenantId, entryId, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Restore_NotTrashed_ThrowsInvalidOperation()
    {
        var entry = MakeEntry(isTrashed: false);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var act = () => Sut.RestoreEntryAsync(TenantId, entry.Id, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not in trash*");
    }

    [Fact]
    public async Task Restore_Trashed_SetsIsTrashedFalse()
    {
        var entry = MakeEntry(isTrashed: true);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.RestoreEntryAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsTrashed.Should().BeFalse();
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }

    // ── DeleteEntryPermanentlyAsync ──────────────────────────────

    [Fact]
    public async Task Delete_NotTrashed_ThrowsInvalidOperation()
    {
        var entry = MakeEntry(isTrashed: false);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var act = () => Sut.DeleteEntryPermanentlyAsync(TenantId, entry.Id, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*trashed*");
    }

    [Fact]
    public async Task Delete_Trashed_CallsRepoDelete()
    {
        var entry = MakeEntry(isTrashed: true);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        await Sut.DeleteEntryPermanentlyAsync(TenantId, entry.Id, CancellationToken.None);

        await EntryRepo.Received(1).DeleteAsync(TenantId, entry.Id, Arg.Any<CancellationToken>());
    }
}
