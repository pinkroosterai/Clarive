using Clarive.Infrastructure.Cache;
using Clarive.Domain.QueryResults;
using Clarive.Domain.Errors;
using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Application.Folders;

public class FolderService(
    IFolderRepository folderRepo,
    IEntryRepository entryRepo,
    TenantCacheService cache
) : IFolderService
{
    public async Task<ErrorOr<List<FolderDto>>> GetTreeAsync(Guid tenantId, CancellationToken ct)
    {
        var tree = await cache.GetOrCreateAsync(
            TenantCacheKeys.FolderTreeKey,
            tenantId,
            _ => folderRepo.GetTreeAsync(tenantId, ct),
            TenantCacheKeys.FolderTreeTtl,
            ct
        );

        return tree;
    }

    public async Task<ErrorOr<Folder>> CreateAsync(
        Guid tenantId,
        CreateFolderRequest request,
        CancellationToken ct
    )
    {
        if (
            request.ParentId is not null
            && await folderRepo.GetByIdAsync(tenantId, request.ParentId.Value, ct) is null
        )
            return DomainErrors.ParentFolderNotFound;

        var folder = await folderRepo.CreateAsync(
            new Folder
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = request.Name.Trim(),
                ParentId = request.ParentId,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        await TenantCacheKeys.EvictFolderData(cache, tenantId);

        return folder;
    }

    public async Task<ErrorOr<Folder>> RenameAsync(
        Guid tenantId,
        Guid folderId,
        RenameFolderRequest request,
        CancellationToken ct
    )
    {
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return DomainErrors.FolderNotFound;

        folder.Name = request.Name.Trim();
        await folderRepo.UpdateAsync(folder, ct);

        await TenantCacheKeys.EvictFolderData(cache, tenantId);

        return folder;
    }

    public async Task<ErrorOr<Success>> DeleteAsync(
        Guid tenantId,
        Guid folderId,
        CancellationToken ct
    )
    {
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return DomainErrors.FolderNotFound;

        var children = await folderRepo.GetChildrenAsync(tenantId, folderId, ct);
        if (children.Count > 0)
            return Error.Conflict(
                "FOLDER_NOT_EMPTY",
                "Cannot delete a folder that contains subfolders."
            );

        var (_, entryCount) = await entryRepo.GetByFolderAsync(
            tenantId,
            folderId,
            includeAll: false,
            new EntryQueryOptions(PageSize: 1),
            ct
        );
        if (entryCount > 0)
            return Error.Conflict(
                "FOLDER_NOT_EMPTY",
                "Cannot delete a folder that contains entries."
            );

        await folderRepo.DeleteAsync(tenantId, folderId, ct);

        await TenantCacheKeys.EvictFolderData(cache, tenantId);

        return Result.Success;
    }

    public async Task<ErrorOr<Folder>> MoveAsync(
        Guid tenantId,
        Guid folderId,
        MoveFolderRequest request,
        CancellationToken ct
    )
    {
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return DomainErrors.FolderNotFound;

        if (request.ParentId == folderId)
            return Error.Conflict("CIRCULAR_REFERENCE", "Cannot move a folder into itself.");

        if (request.ParentId is not null)
        {
            if (await folderRepo.GetByIdAsync(tenantId, request.ParentId.Value, ct) is null)
                return DomainErrors.TargetParentFolderNotFound;

            if (
                await folderRepo.IsDescendantOfAsync(tenantId, request.ParentId.Value, folderId, ct)
            )
                return Error.Conflict(
                    "CIRCULAR_REFERENCE",
                    "Cannot move a folder into one of its descendants."
                );
        }

        folder.ParentId = request.ParentId;
        await folderRepo.UpdateAsync(folder, ct);

        await TenantCacheKeys.EvictFolderData(cache, tenantId);

        return folder;
    }
}
