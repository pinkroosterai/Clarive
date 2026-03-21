using Clarive.Api.Helpers;
using Clarive.Application.Entries.Contracts;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleFavorite(
        Guid entryId,
        HttpContext ctx,
        IEntryFavoriteService favoriteService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var result = await favoriteService.FavoriteEntryAsync(tenantId, userId, entryId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.NoContent();
    }

    private static async Task<IResult> HandleUnfavorite(
        Guid entryId,
        HttpContext ctx,
        IEntryFavoriteService favoriteService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var result = await favoriteService.UnfavoriteEntryAsync(tenantId, userId, entryId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.NoContent();
    }
}
