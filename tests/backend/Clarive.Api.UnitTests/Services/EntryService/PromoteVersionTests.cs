using FluentAssertions;
using NSubstitute;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class PromoteVersionTests : EntryServiceTestBase
{
    [Fact]
    public async Task Promote_EntryNotFound_ThrowsKeyNotFound()
    {
        var entryId = Guid.NewGuid();
        EntryRepo.GetByIdAsync(TenantId, entryId, Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var act = () => Sut.PromoteVersionAsync(TenantId, entryId, 1, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Promote_VersionNotHistorical_ThrowsKeyNotFound()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        // version exists but is Draft, not Historical
        var draftVersion = MakeVersion(entry.Id, version: 1, state: VersionState.Draft);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 1, Arg.Any<CancellationToken>()).Returns(draftVersion);

        var act = () => Sut.PromoteVersionAsync(TenantId, entry.Id, 1, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*Historical*");
    }

    [Fact]
    public async Task Promote_VersionNotFound_ThrowsKeyNotFound()
    {
        var entry = MakeEntry();
        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 99, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null);

        var act = () => Sut.PromoteVersionAsync(TenantId, entry.Id, 99, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task Promote_Historical_CreatesNewDraft()
    {
        var entry = MakeEntry();
        var historical = MakeVersion(entry.Id, version: 1, state: VersionState.Historical,
            systemMessage: "Old system");

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 1, Arg.Any<CancellationToken>()).Returns(historical);
        EntryRepo.GetMaxVersionNumberAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(2);
        EntryRepo.GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>())
            .Returns((PromptEntryVersion?)null); // no existing draft

        var (_, newDraft) = await Sut.PromoteVersionAsync(
            TenantId, entry.Id, 1, CancellationToken.None);

        newDraft.Version.Should().Be(3); // maxVersion(2) + 1
        newDraft.VersionState.Should().Be(VersionState.Draft);
        newDraft.SystemMessage.Should().Be("Old system");

        await EntryRepo.Received(1).CreateVersionAsync(
            Arg.Is<PromptEntryVersion>(v => v.Version == 3), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Promote_ExistingDraftDeleted_BeforeCreatingNew()
    {
        var entry = MakeEntry();
        var historical = MakeVersion(entry.Id, version: 1, state: VersionState.Historical);
        var existingDraft = MakeVersion(entry.Id, version: 2, state: VersionState.Draft);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 1, Arg.Any<CancellationToken>()).Returns(historical);
        EntryRepo.GetMaxVersionNumberAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(2);
        EntryRepo.GetWorkingVersionAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(existingDraft);

        await Sut.PromoteVersionAsync(TenantId, entry.Id, 1, CancellationToken.None);

        await EntryRepo.Received(1).DeleteVersionAsync(existingDraft, Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>());
    }
}
