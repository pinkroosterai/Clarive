using System.ComponentModel;
using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleGetActivity(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 50)")] int? pageSize = null
    )
    {
        var tenantId = ctx.GetTenantId();
        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0
            ? Math.Min(pageSize.Value, MaxActivityPageSize)
            : DefaultActivityPageSize;

        var result = await entryService.GetEntryActivityAsync(tenantId, entryId, p, ps, ct);
        return result.IsError
            ? result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString())
            : Results.Ok(result.Value);
    }
}
