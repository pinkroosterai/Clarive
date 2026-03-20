using Clarive.Domain.QueryResults;
using Clarive.Domain.Entities;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Core.Models.Responses;
using ErrorOr;

namespace Clarive.Core.Services.Interfaces;

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
}
