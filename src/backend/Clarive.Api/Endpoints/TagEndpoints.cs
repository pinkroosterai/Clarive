using Clarive.Application.Tags.Contracts;
using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static class TagEndpoints
{
    public static RouteGroupBuilder MapTagEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/tags").WithTags("Tags").RequireAuthorization();

        group.MapGet("/", HandleList).AddEndpointFilter(new CacheControlFilter(300));
        group.MapPut("/{tagName}", HandleRename).RequireAuthorization("AdminOnly");
        group.MapDelete("/{tagName}", HandleDelete).RequireAuthorization("AdminOnly");

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        ITagService tagService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var tags = await tagService.GetAllAsync(tenantId, ct);
        return Results.Ok(tags);
    }

    private static async Task<IResult> HandleRename(
        string tagName,
        HttpContext ctx,
        RenameTagRequest request,
        ITagService tagService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await tagService.RenameAsync(tenantId, tagName, request.NewName, ct);

        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.NoContent();
    }

    private static async Task<IResult> HandleDelete(
        string tagName,
        HttpContext ctx,
        ITagService tagService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        await tagService.DeleteAsync(tenantId, tagName, ct);
        return Results.NoContent();
    }
}
