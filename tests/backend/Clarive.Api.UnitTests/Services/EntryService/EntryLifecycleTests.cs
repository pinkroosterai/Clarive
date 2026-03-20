using Clarive.Domain.Entities;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class EntryLifecycleTests : EntryServiceTestBase
{
    // ── TrashEntryAsync ──────────────────────────────────────────

    [Fact]
    public async Task Trash_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.TrashEntryAsync(TenantId, entryId, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Trash_SetsIsTrashedTrue()
    {
        var entry = MakeEntry(isTrashed: false);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.TrashEntryAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.IsTrashed.Should().BeTrue();
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }

    // ── RestoreEntryAsync ────────────────────────────────────────

    [Fact]
    public async Task Restore_EntryNotFound_ReturnsNotFoundError()
    {
        var entryId = Guid.NewGuid();
        EntryRepo
            .GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await Sut.RestoreEntryAsync(TenantId, entryId, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Restore_NotTrashed_ReturnsConflictError()
    {
        var entry = MakeEntry(isTrashed: false);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.RestoreEntryAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
        result.FirstError.Code.Should().Be("NOT_TRASHED");
    }

    [Fact]
    public async Task Restore_Trashed_SetsIsTrashedFalse()
    {
        var entry = MakeEntry(isTrashed: true);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.RestoreEntryAsync(TenantId, entry.Id, CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.IsTrashed.Should().BeFalse();
        await EntryRepo.Received(1).UpdateAsync(entry, Arg.Any<CancellationToken>());
    }

    // ── DeleteEntryPermanentlyAsync ──────────────────────────────

    [Fact]
    public async Task Delete_NotTrashed_ReturnsConflictError()
    {
        var entry = MakeEntry(isTrashed: false);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.DeleteEntryPermanentlyAsync(
            TenantId,
            entry.Id,
            CancellationToken.None
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Conflict);
        result.FirstError.Code.Should().Be("NOT_TRASHED");
    }

    [Fact]
    public async Task Delete_Trashed_CallsRepoDelete()
    {
        var entry = MakeEntry(isTrashed: true);
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var result = await Sut.DeleteEntryPermanentlyAsync(
            TenantId,
            entry.Id,
            CancellationToken.None
        );

        result.IsError.Should().BeFalse();
        await EntryRepo.Received(1).DeleteAsync(TenantId, entry.Id, Arg.Any<CancellationToken>());
    }
}
