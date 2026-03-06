using FluentAssertions;
using NSubstitute;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class CreateEntryTests : EntryServiceTestBase
{
    [Fact]
    public async Task CreateEntry_Valid_CreatesEntryAndDraftV1()
    {
        var request = ValidCreateRequest(title: " My Prompt ");

        var (entry, version) = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        entry.Title.Should().Be("My Prompt"); // trimmed
        entry.TenantId.Should().Be(TenantId);
        entry.CreatedBy.Should().Be(UserId);
        entry.IsTrashed.Should().BeFalse();

        version.Version.Should().Be(1);
        version.VersionState.Should().Be(VersionState.Draft);
        version.Prompts.Should().HaveCount(1);

        await EntryRepo.Received(1).CreateAsync(Arg.Any<PromptEntry>(), Arg.Any<CancellationToken>());
        await EntryRepo.Received(1).CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateEntry_FolderNotFound_ThrowsKeyNotFound()
    {
        var folderId = Guid.NewGuid();
        FolderRepo.GetByIdAsync(TenantId, folderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var request = ValidCreateRequest(folderId: folderId);

        var act = () => Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*Folder*");
    }

    [Fact]
    public async Task CreateEntry_FolderExists_EntryHasCorrectFolderId()
    {
        var folder = MakeFolder();
        FolderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>())
            .Returns(folder);

        var request = ValidCreateRequest(folderId: folder.Id);

        var (entry, _) = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        entry.FolderId.Should().Be(folder.Id);
    }

    [Fact]
    public async Task CreateEntry_TemplateContent_DetectedAutomatically()
    {
        var request = ValidCreateRequest(prompts: [new PromptInput("Hello {{user}}")]);

        var (_, version) = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        version.Prompts[0].IsTemplate.Should().BeTrue();
        version.Prompts[0].TemplateFields.Should().NotBeEmpty();
    }
}
