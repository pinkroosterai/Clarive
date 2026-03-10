using System.Text.RegularExpressions;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Microsoft.Extensions.Caching.Memory;

namespace Clarive.Api.Endpoints;

public static partial class TagEndpoints
{
    public static RouteGroupBuilder MapTagEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tags")
            .WithTags("Tags")
            .RequireAuthorization();

        group.MapGet("/", HandleList);
        group.MapPut("/{tagName}", HandleRename).RequireAuthorization("AdminOnly");
        group.MapDelete("/{tagName}", HandleDelete).RequireAuthorization("AdminOnly");

        return group;
    }

    [GeneratedRegex(@"^[a-z0-9][a-z0-9 \-]*$")]
    private static partial Regex TagNamePattern();

    private static string? NormalizeTagName(string? name)
    {
        return name?.Trim().ToLowerInvariant();
    }

    private static string? ValidateTagName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "Tag name is required.";
        if (name.Length > 50)
            return "Tag name must be 50 characters or fewer.";
        if (!TagNamePattern().IsMatch(name))
            return "Tag name can only contain lowercase letters, numbers, hyphens, and spaces.";
        return null;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        ITagRepository tagRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var cacheKey = TenantCacheKeys.WorkspaceTags(tenantId);

        var tags = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.SetOptions(TenantCacheKeys.WorkspaceTagsOptions);
            return await tagRepo.GetAllWithCountsAsync(tenantId, ct);
        });

        var response = tags!.Select(t => new TagSummary(t.TagName, t.EntryCount)).ToList();
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleRename(
        string tagName,
        HttpContext ctx,
        RenameTagRequest request,
        ITagRepository tagRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var normalizedOld = NormalizeTagName(tagName);
        var normalizedNew = NormalizeTagName(request.NewName);

        var error = ValidateTagName(normalizedNew);
        if (error is not null)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", error);

        if (normalizedOld == normalizedNew)
            return Results.NoContent();

        await tagRepo.RenameAsync(tenantId, normalizedOld!, normalizedNew!, ct);
        TenantCacheKeys.EvictTagData(cache, tenantId);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleDelete(
        string tagName,
        HttpContext ctx,
        ITagRepository tagRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var normalized = NormalizeTagName(tagName);

        await tagRepo.DeleteAsync(tenantId, normalized!, ct);
        TenantCacheKeys.EvictTagData(cache, tenantId);

        return Results.NoContent();
    }
}
