using Clarive.Domain.Entities;
using Clarive.Domain.QueryResults;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IFolderRepository
{
    Task<List<FolderDto>> GetTreeAsync(Guid tenantId, CancellationToken ct = default);
    Task<Folder?> GetByIdAsync(Guid tenantId, Guid folderId, CancellationToken ct = default);
    Task<Dictionary<Guid, Folder>> GetByIdsAsync(
        Guid tenantId,
        IEnumerable<Guid> folderIds,
        CancellationToken ct = default
    );
    Task<List<Folder>> GetChildrenAsync(
        Guid tenantId,
        Guid folderId,
        CancellationToken ct = default
    );
    Task<Folder> CreateAsync(Folder folder, CancellationToken ct = default);
    Task<Folder> UpdateAsync(Folder folder, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid folderId, CancellationToken ct = default);
    Task<bool> IsDescendantOfAsync(
        Guid tenantId,
        Guid folderId,
        Guid potentialAncestorId,
        CancellationToken ct = default
    );

    // Dashboard
    Task<int> GetCountAsync(Guid tenantId, CancellationToken ct = default);
}
