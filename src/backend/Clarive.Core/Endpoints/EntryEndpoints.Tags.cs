using Clarive.Core.Helpers;
using Clarive.Core.Helpers;
using Clarive.Core.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Core.Services.Interfaces;

namespace Clarive.Core.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleGetEntryTags(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await entryService.GetEntryTagsAsync(tenantId, entryId, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleAddTags(
        Guid entryId,
        HttpContext ctx,
        AddTagsRequest request,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await entryService.AddEntryTagsAsync(tenantId, entryId, request.Tags, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleRemoveTag(
        Guid entryId,
        string tagName,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await entryService.RemoveEntryTagAsync(tenantId, entryId, tagName, ct);
        return result.IsError ? result.Errors.ToHttpResult(ctx) : Results.NoContent();
    }
}
