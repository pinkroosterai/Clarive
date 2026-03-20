using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using ErrorOr;
using FluentAssertions;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services.EntryService;

public class CreateEntryTests : EntryServiceTestBase
{
    [Fact]
    public async Task CreateEntry_Valid_CreatesEntryAndDraftV1()
    {
        var request = ValidCreateRequest(title: " My Prompt ");

        var result = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        result.IsError.Should().BeFalse();
        var (entry, version) = result.Value;

        entry.Title.Should().Be("My Prompt"); // trimmed
        entry.TenantId.Should().Be(TenantId);
        entry.CreatedBy.Should().Be(UserId);
        entry.IsTrashed.Should().BeFalse();

        version.Version.Should().Be(1);
        version.VersionState.Should().Be(VersionState.Draft);
        version.Prompts.Should().HaveCount(1);

        await EntryRepo
            .Received(1)
            .CreateAsync(Arg.Any<PromptEntry>(), Arg.Any<CancellationToken>());
        await EntryRepo
            .Received(1)
            .CreateVersionAsync(Arg.Any<PromptEntryVersion>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateEntry_FolderNotFound_ReturnsNotFoundError()
    {
        var folderId = Guid.NewGuid();
        FolderRepo
            .GetByIdAsync(TenantId, folderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var request = ValidCreateRequest(folderId: folderId);

        var result = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task CreateEntry_FolderExists_EntryHasCorrectFolderId()
    {
        var folder = MakeFolder();
        FolderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);

        var request = ValidCreateRequest(folderId: folder.Id);

        var result = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Entry.FolderId.Should().Be(folder.Id);
    }

    [Fact]
    public async Task CreateEntry_TemplateContent_DetectedAutomatically()
    {
        var request = ValidCreateRequest(prompts: [new PromptInput("Hello {{user}}")]);

        var result = await Sut.CreateEntryAsync(TenantId, UserId, request, CancellationToken.None);

        result.IsError.Should().BeFalse();
        var (_, version) = result.Value;

        version.Prompts[0].IsTemplate.Should().BeTrue();
        version.Prompts[0].TemplateFields.Should().NotBeEmpty();
    }
}
