using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;

namespace Clarive.Api.Endpoints;

public static class TagEndpoints
{
    private const int MaxTagNameLength = 50;

    public static RouteGroupBuilder MapTagEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tags").WithTags("Tags").RequireAuthorization();

        group.MapGet("/", HandleList).AddEndpointFilter(new CacheControlFilter(300));
        group.MapPut("/{tagName}", HandleRename).RequireAuthorization("AdminOnly");
        group.MapDelete("/{tagName}", HandleDelete).RequireAuthorization("AdminOnly");

        return group;
    }

    private static string? NormalizeTagName(string? name)
    {
        return name?.Trim().ToLowerInvariant();
    }

    private static string? ValidateTagName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "Tag name is required.";
        if (name.Length > MaxTagNameLength)
            return $"Tag name must be {MaxTagNameLength} characters or fewer.";
        if (!TagValidation.TagNamePattern().IsMatch(name))
            return "Tag name can only contain lowercase letters, numbers, hyphens, and spaces.";
        return null;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        ITagRepository tagRepo,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var tags = await cache.GetOrCreateAsync(
            TenantCacheKeys.WorkspaceTagsKey,
            tenantId,
            _ => tagRepo.GetAllWithCountsAsync(tenantId, ct),
            TenantCacheKeys.WorkspaceTagsTtl,
            ct
        );

        var response = tags.Select(t => new TagSummary(t.TagName, t.EntryCount)).ToList();
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleRename(
        string tagName,
        HttpContext ctx,
        RenameTagRequest request,
        ITagRepository tagRepo,
        TenantCacheService cache,
        CancellationToken ct
    )
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
        await TenantCacheKeys.EvictTagData(cache, tenantId);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleDelete(
        string tagName,
        HttpContext ctx,
        ITagRepository tagRepo,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var normalized = NormalizeTagName(tagName);

        await tagRepo.DeleteAsync(tenantId, normalized!, ct);
        await TenantCacheKeys.EvictTagData(cache, tenantId);

        return Results.NoContent();
    }
}
