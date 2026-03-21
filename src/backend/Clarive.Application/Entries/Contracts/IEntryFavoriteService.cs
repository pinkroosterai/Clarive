using ErrorOr;

namespace Clarive.Application.Entries.Contracts;

public interface IEntryFavoriteService
{
    Task<ErrorOr<Success>> FavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task<ErrorOr<Success>> UnfavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );
}
