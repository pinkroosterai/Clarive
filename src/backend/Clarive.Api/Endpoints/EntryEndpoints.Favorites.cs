using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleFavorite(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IFavoriteRepository favoriteRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        if (await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct))
            return Results.NoContent();

        await favoriteRepo.AddAsync(new EntryFavorite
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            EntryId = entryId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleUnfavorite(
        Guid entryId,
        HttpContext ctx,
        IFavoriteRepository favoriteRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        await favoriteRepo.RemoveAsync(tenantId, userId, entryId, ct);
        return Results.NoContent();
    }
}
