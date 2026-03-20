using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleFavorite(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var result = await entryService.FavoriteEntryAsync(tenantId, userId, entryId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.NoContent();
    }

    private static async Task<IResult> HandleUnfavorite(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var result = await entryService.UnfavoriteEntryAsync(tenantId, userId, entryId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.NoContent();
    }
}
