using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IFavoriteRepository
{
    Task<bool> ExistsAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct = default
    );
    Task AddAsync(EntryFavorite favorite, CancellationToken ct = default);
    Task RemoveAsync(Guid tenantId, Guid userId, Guid entryId, CancellationToken ct = default);
    Task<HashSet<Guid>> GetFavoritedEntryIdsAsync(
        Guid tenantId,
        Guid userId,
        List<Guid> entryIds,
        CancellationToken ct = default
    );
    Task<List<(Guid EntryId, DateTime CreatedAt)>> GetByUserAsync(
        Guid tenantId,
        Guid userId,
        int limit,
        CancellationToken ct = default
    );
}
