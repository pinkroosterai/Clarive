using Clarive.Domain.QueryResults;
using Clarive.Domain.Entities;
using Clarive.Domain.ValueObjects;
using ErrorOr;

namespace Clarive.Application.Folders.Contracts;

public interface IFolderService
{
    Task<ErrorOr<List<FolderDto>>> GetTreeAsync(Guid tenantId, CancellationToken ct = default);

    Task<ErrorOr<Folder>> CreateAsync(
        Guid tenantId,
        CreateFolderRequest request,
        CancellationToken ct = default
    );

    Task<ErrorOr<Folder>> RenameAsync(
        Guid tenantId,
        Guid folderId,
        RenameFolderRequest request,
        CancellationToken ct = default
    );

    Task<ErrorOr<Success>> DeleteAsync(
        Guid tenantId,
        Guid folderId,
        CancellationToken ct = default
    );

    Task<ErrorOr<Folder>> MoveAsync(
        Guid tenantId,
        Guid folderId,
        MoveFolderRequest request,
        CancellationToken ct = default
    );

    Task<ErrorOr<Folder>> SetColorAsync(
        Guid tenantId,
        Guid folderId,
        SetFolderColorRequest request,
        CancellationToken ct = default
    );
}
