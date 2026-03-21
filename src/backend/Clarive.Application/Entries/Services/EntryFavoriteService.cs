using Clarive.Application.Entries.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Application.Entries.Services;

public class EntryFavoriteService(
    IEntryRepository entryRepo,
    IFavoriteRepository favoriteRepo
) : IEntryFavoriteService
{
    public async Task<ErrorOr<Success>> FavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return DomainErrors.EntryNotFound;

        if (await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct))
            return Result.Success;

        await favoriteRepo.AddAsync(
            new EntryFavorite
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                EntryId = entryId,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        return Result.Success;
    }

    public async Task<ErrorOr<Success>> UnfavoriteEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        CancellationToken ct
    )
    {
        await favoriteRepo.RemoveAsync(tenantId, userId, entryId, ct);
        return Result.Success;
    }
}
