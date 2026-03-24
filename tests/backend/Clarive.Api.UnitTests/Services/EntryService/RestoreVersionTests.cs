using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class RestoreVersionTests : EntryServiceTestBase
{
    [Fact]
    public async Task RestoreVersion_EntryNotFound_ReturnsError()
    {
        EntryRepo.GetByIdAsync(TenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((PromptEntry?)null);

        var result = await VersionSut.RestoreVersionAsync(TenantId, Guid.NewGuid(), 1, null, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task RestoreVersion_VersionNotHistorical_ReturnsError()
    {
        var entry = MakeEntry();
        var published = MakeVersion(entry.Id, version: 1, state: VersionState.Published);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 1, Arg.Any<CancellationToken>()).Returns(published);

        var result = await VersionSut.RestoreVersionAsync(TenantId, entry.Id, 1, null, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("VERSION_NOT_FOUND");
    }

    [Fact]
    public async Task RestoreVersion_NoTarget_CreatesNewTab()
    {
        var entry = MakeEntry();
        var historical = MakeVersion(entry.Id, version: 1, state: VersionState.Historical);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 1, Arg.Any<CancellationToken>()).Returns(historical);

        var result = await VersionSut.RestoreVersionAsync(TenantId, entry.Id, 1, null, CancellationToken.None);

        result.IsError.Should().BeFalse();
        var (_, newTab) = result.Value;
        newTab.VersionState.Should().Be(VersionState.Tab);
        newTab.TabName.Should().Be("Restored v1");
        newTab.ForkedFromVersion.Should().Be(1);
        newTab.IsMainTab.Should().BeFalse();
    }

    [Fact]
    public async Task RestoreVersion_WithTarget_LoadsIntoExistingTab()
    {
        var entry = MakeEntry();
        var historical = MakeVersion(entry.Id, version: 1, state: VersionState.Historical);
        var targetTab = MakeVersion(entry.Id, version: 0, state: VersionState.Tab);

        EntryRepo.GetByIdAsync(TenantId, entry.Id, Arg.Any<CancellationToken>()).Returns(entry);
        EntryRepo.GetVersionAsync(TenantId, entry.Id, 1, Arg.Any<CancellationToken>()).Returns(historical);
        EntryRepo.GetVersionByIdAsync(TenantId, targetTab.Id, Arg.Any<CancellationToken>()).Returns(targetTab);

        var result = await VersionSut.RestoreVersionAsync(TenantId, entry.Id, 1, targetTab.Id, CancellationToken.None);

        result.IsError.Should().BeFalse();
        var (_, restoredTab) = result.Value;
        restoredTab.Id.Should().Be(targetTab.Id);
        restoredTab.SystemMessage.Should().Be(historical.SystemMessage);
        restoredTab.ForkedFromVersion.Should().Be(1);
    }
}
