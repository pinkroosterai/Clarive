using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.Extensions.Caching.Memory;

namespace Clarive.Api.Services;

public class FolderService(
    IFolderRepository folderRepo,
    IEntryRepository entryRepo,
    IMemoryCache cache) : IFolderService
{
    public async Task<ErrorOr<List<FolderDto>>> GetTreeAsync(Guid tenantId, CancellationToken ct)
    {
        var cacheKey = TenantCacheKeys.FolderTree(tenantId);

        var tree = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.SetOptions(TenantCacheKeys.FolderTreeOptions);
            return await folderRepo.GetTreeAsync(tenantId, ct);
        });

        return tree!;
    }

    public async Task<ErrorOr<Folder>> CreateAsync(Guid tenantId, CreateFolderRequest request, CancellationToken ct)
    {
        if (request.ParentId is not null && await folderRepo.GetByIdAsync(tenantId, request.ParentId.Value, ct) is null)
            return Error.NotFound("NOT_FOUND", "Parent folder not found.");

        var folder = await folderRepo.CreateAsync(new Folder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            ParentId = request.ParentId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return folder;
    }

    public async Task<ErrorOr<Folder>> RenameAsync(Guid tenantId, Guid folderId, RenameFolderRequest request, CancellationToken ct)
    {
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return Error.NotFound("NOT_FOUND", "Folder not found.");

        folder.Name = request.Name.Trim();
        await folderRepo.UpdateAsync(folder, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return folder;
    }

    public async Task<ErrorOr<Success>> DeleteAsync(Guid tenantId, Guid folderId, CancellationToken ct)
    {
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return Error.NotFound("NOT_FOUND", "Folder not found.");

        var children = await folderRepo.GetChildrenAsync(tenantId, folderId, ct);
        if (children.Count > 0)
            return Error.Conflict("FOLDER_NOT_EMPTY", "Cannot delete a folder that contains subfolders.");

        var (_, entryCount) = await entryRepo.GetByFolderAsync(tenantId, folderId, includeAll: false, pageSize: 1, ct: ct);
        if (entryCount > 0)
            return Error.Conflict("FOLDER_NOT_EMPTY", "Cannot delete a folder that contains entries.");

        await folderRepo.DeleteAsync(tenantId, folderId, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return Result.Success;
    }

    public async Task<ErrorOr<Folder>> MoveAsync(Guid tenantId, Guid folderId, MoveFolderRequest request, CancellationToken ct)
    {
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return Error.NotFound("NOT_FOUND", "Folder not found.");

        if (request.ParentId == folderId)
            return Error.Conflict("CIRCULAR_REFERENCE", "Cannot move a folder into itself.");

        if (request.ParentId is not null)
        {
            if (await folderRepo.GetByIdAsync(tenantId, request.ParentId.Value, ct) is null)
                return Error.NotFound("NOT_FOUND", "Target parent folder not found.");

            if (await folderRepo.IsDescendantOfAsync(tenantId, request.ParentId.Value, folderId, ct))
                return Error.Conflict("CIRCULAR_REFERENCE", "Cannot move a folder into one of its descendants.");
        }

        folder.ParentId = request.ParentId;
        await folderRepo.UpdateAsync(folder, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return folder;
    }
}
