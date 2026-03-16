using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Microsoft.Extensions.Caching.Memory;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    private static async Task<IResult> HandleGetEntryTags(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var tags = await tagRepo.GetByEntryIdAsync(tenantId, entryId, ct);
        return Results.Ok(tags);
    }

    private static async Task<IResult> HandleAddTags(
        Guid entryId,
        HttpContext ctx,
        AddTagsRequest request,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        if (request.Tags is null || request.Tags.Count == 0)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "At least one tag is required.");

        var normalized = new List<string>();
        foreach (var tag in request.Tags)
        {
            var name = tag.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(name) || name.Length > MaxTagNameLength || !TagValidation.TagNamePattern().IsMatch(name))
                return ctx.ErrorResult(422, "VALIDATION_ERROR", $"Invalid tag name: '{tag}'. Tags can only contain lowercase letters, numbers, hyphens, and spaces.");
            normalized.Add(name);
        }

        await tagRepo.AddAsync(tenantId, entryId, normalized.Distinct().ToList(), ct);
        TenantCacheKeys.EvictTagData(cache, tenantId);

        var tags = await tagRepo.GetByEntryIdAsync(tenantId, entryId, ct);
        return Results.Ok(tags);
    }

    private static async Task<IResult> HandleRemoveTag(
        Guid entryId,
        string tagName,
        HttpContext ctx,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        await tagRepo.RemoveAsync(tenantId, entryId, tagName.Trim().ToLowerInvariant(), ct);
        TenantCacheKeys.EvictTagData(cache, tenantId);

        return Results.NoContent();
    }
}
