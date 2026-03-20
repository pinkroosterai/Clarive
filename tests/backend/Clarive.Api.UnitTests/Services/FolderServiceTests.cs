using Clarive.Infrastructure.Cache;
using Clarive.Domain.QueryResults;
using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace Clarive.Api.UnitTests.Services;

public class FolderServiceTests
{
    private readonly IFolderRepository _folderRepo = Substitute.For<IFolderRepository>();
    private readonly IEntryRepository _entryRepo = Substitute.For<IEntryRepository>();
    private readonly TenantCacheService _cache;
    private readonly FolderService _sut;

    private static readonly Guid TenantId = Guid.NewGuid();

    public FolderServiceTests()
    {
        _cache = new TenantCacheService(
            new ZiggyCreatures.Caching.Fusion.FusionCache(new ZiggyCreatures.Caching.Fusion.FusionCacheOptions())
        );

        _folderRepo
            .CreateAsync(Arg.Any<Folder>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<Folder>());

        _folderRepo
            .UpdateAsync(Arg.Any<Folder>(), Arg.Any<CancellationToken>())
            .Returns(ci => ci.Arg<Folder>());

        _sut = new FolderService(_folderRepo, _entryRepo, _cache);
    }

    private static Folder MakeFolder(Guid? id = null, Guid? parentId = null) =>
        new()
        {
            Id = id ?? Guid.NewGuid(),
            TenantId = TenantId,
            Name = "Test Folder",
            ParentId = parentId,
            CreatedAt = DateTime.UtcNow,
        };

    // ── GetTreeAsync ──

    [Fact]
    public async Task GetTreeAsync_ReturnsFolderTree()
    {
        var tree = new List<FolderDto> { new(Guid.NewGuid(), "Root", null, []) };
        _folderRepo.GetTreeAsync(TenantId, Arg.Any<CancellationToken>()).Returns(tree);

        var result = await _sut.GetTreeAsync(TenantId, default);

        result.IsError.Should().BeFalse();
        result.Value.Should().BeEquivalentTo(tree);
    }

    // ── CreateAsync ──

    [Fact]
    public async Task CreateAsync_Success_ReturnsFolder()
    {
        var request = new CreateFolderRequest("New Folder", null);

        var result = await _sut.CreateAsync(TenantId, request, default);

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("New Folder");
        result.Value.TenantId.Should().Be(TenantId);
    }

    [Fact]
    public async Task CreateAsync_WithValidParent_ReturnsFolder()
    {
        var parentId = Guid.NewGuid();
        _folderRepo
            .GetByIdAsync(TenantId, parentId, Arg.Any<CancellationToken>())
            .Returns(MakeFolder(parentId));

        var request = new CreateFolderRequest("Child Folder", parentId);
        var result = await _sut.CreateAsync(TenantId, request, default);

        result.IsError.Should().BeFalse();
        result.Value.ParentId.Should().Be(parentId);
    }

    [Fact]
    public async Task CreateAsync_ParentNotFound_ReturnsNotFound()
    {
        var parentId = Guid.NewGuid();
        _folderRepo
            .GetByIdAsync(TenantId, parentId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var request = new CreateFolderRequest("Child Folder", parentId);
        var result = await _sut.CreateAsync(TenantId, request, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    // ── RenameAsync ──

    [Fact]
    public async Task RenameAsync_Success_ReturnsRenamedFolder()
    {
        var folder = MakeFolder();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);

        var result = await _sut.RenameAsync(
            TenantId,
            folder.Id,
            new RenameFolderRequest("Renamed"),
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.Name.Should().Be("Renamed");
    }

    [Fact]
    public async Task RenameAsync_FolderNotFound_ReturnsNotFound()
    {
        var folderId = Guid.NewGuid();
        _folderRepo
            .GetByIdAsync(TenantId, folderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var result = await _sut.RenameAsync(
            TenantId,
            folderId,
            new RenameFolderRequest("Renamed"),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    // ── DeleteAsync ──

    [Fact]
    public async Task DeleteAsync_EmptyFolder_ReturnsSuccess()
    {
        var folder = MakeFolder();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);
        _folderRepo
            .GetChildrenAsync(TenantId, folder.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Folder>());
        _entryRepo
            .GetByFolderAsync(
                TenantId,
                folder.Id,
                false,
                Arg.Any<EntryQueryOptions>(),
                Arg.Any<CancellationToken>()
            )
            .Returns((new List<PromptEntry>(), 0));

        var result = await _sut.DeleteAsync(TenantId, folder.Id, default);

        result.IsError.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_FolderNotFound_ReturnsNotFound()
    {
        var folderId = Guid.NewGuid();
        _folderRepo
            .GetByIdAsync(TenantId, folderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var result = await _sut.DeleteAsync(TenantId, folderId, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task DeleteAsync_HasChildFolders_ReturnsConflict()
    {
        var folder = MakeFolder();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);
        _folderRepo
            .GetChildrenAsync(TenantId, folder.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Folder> { MakeFolder() });

        var result = await _sut.DeleteAsync(TenantId, folder.Id, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("FOLDER_NOT_EMPTY");
    }

    [Fact]
    public async Task DeleteAsync_HasEntries_ReturnsConflict()
    {
        var folder = MakeFolder();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);
        _folderRepo
            .GetChildrenAsync(TenantId, folder.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Folder>());
        _entryRepo
            .GetByFolderAsync(
                TenantId,
                folder.Id,
                false,
                Arg.Any<EntryQueryOptions>(),
                Arg.Any<CancellationToken>()
            )
            .Returns((new List<PromptEntry>(), 1));

        var result = await _sut.DeleteAsync(TenantId, folder.Id, default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("FOLDER_NOT_EMPTY");
    }

    // ── MoveAsync ──

    [Fact]
    public async Task MoveAsync_Success_ReturnsMovedFolder()
    {
        var folder = MakeFolder();
        var targetParentId = Guid.NewGuid();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);
        _folderRepo
            .GetByIdAsync(TenantId, targetParentId, Arg.Any<CancellationToken>())
            .Returns(MakeFolder(targetParentId));
        _folderRepo
            .IsDescendantOfAsync(TenantId, targetParentId, folder.Id, Arg.Any<CancellationToken>())
            .Returns(false);

        var result = await _sut.MoveAsync(
            TenantId,
            folder.Id,
            new MoveFolderRequest(targetParentId),
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.ParentId.Should().Be(targetParentId);
    }

    [Fact]
    public async Task MoveAsync_ToRoot_ReturnsMovedFolder()
    {
        var folder = MakeFolder(parentId: Guid.NewGuid());
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);

        var result = await _sut.MoveAsync(
            TenantId,
            folder.Id,
            new MoveFolderRequest(null),
            default
        );

        result.IsError.Should().BeFalse();
        result.Value.ParentId.Should().BeNull();
    }

    [Fact]
    public async Task MoveAsync_FolderNotFound_ReturnsNotFound()
    {
        var folderId = Guid.NewGuid();
        _folderRepo
            .GetByIdAsync(TenantId, folderId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var result = await _sut.MoveAsync(TenantId, folderId, new MoveFolderRequest(null), default);

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task MoveAsync_ToSelf_ReturnsConflict()
    {
        var folder = MakeFolder();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);

        var result = await _sut.MoveAsync(
            TenantId,
            folder.Id,
            new MoveFolderRequest(folder.Id),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("CIRCULAR_REFERENCE");
    }

    [Fact]
    public async Task MoveAsync_TargetParentNotFound_ReturnsNotFound()
    {
        var folder = MakeFolder();
        var targetParentId = Guid.NewGuid();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);
        _folderRepo
            .GetByIdAsync(TenantId, targetParentId, Arg.Any<CancellationToken>())
            .Returns((Folder?)null);

        var result = await _sut.MoveAsync(
            TenantId,
            folder.Id,
            new MoveFolderRequest(targetParentId),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("NOT_FOUND");
    }

    [Fact]
    public async Task MoveAsync_CircularReference_ReturnsConflict()
    {
        var folder = MakeFolder();
        var targetParentId = Guid.NewGuid();
        _folderRepo.GetByIdAsync(TenantId, folder.Id, Arg.Any<CancellationToken>()).Returns(folder);
        _folderRepo
            .GetByIdAsync(TenantId, targetParentId, Arg.Any<CancellationToken>())
            .Returns(MakeFolder(targetParentId));
        _folderRepo
            .IsDescendantOfAsync(TenantId, targetParentId, folder.Id, Arg.Any<CancellationToken>())
            .Returns(true);

        var result = await _sut.MoveAsync(
            TenantId,
            folder.Id,
            new MoveFolderRequest(targetParentId),
            default
        );

        result.IsError.Should().BeTrue();
        result.FirstError.Code.Should().Be("CIRCULAR_REFERENCE");
    }
}
