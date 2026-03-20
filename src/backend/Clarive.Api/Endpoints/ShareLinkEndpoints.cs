using Clarive.Api.Helpers;
using Clarive.Domain.ValueObjects;

namespace Clarive.Api.Endpoints;

public static class ShareLinkEndpoints
{
    public static RouteGroupBuilder MapShareLinkEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/entries/{entryId:guid}/share-link")
            .WithTags("Share Links")
            .RequireAuthorization("EditorOrAdmin");

        group.MapPost("/", HandleCreate);
        group.MapGet("/", HandleGet);
        group.MapDelete("/", HandleDelete);

        return group;
    }

    private static async Task<IResult> HandleCreate(
        Guid entryId,
        HttpContext ctx,
        CreateShareLinkRequest request,
        IShareLinkService shareLinkService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        if (request.Password is not null && request.Password.Length < 8)
            return ctx.ErrorResult(
                422,
                "VALIDATION_ERROR",
                "Share link password must be at least 8 characters."
            );

        var result = await shareLinkService.CreateAsync(
            tenantId,
            entryId,
            userId,
            request.ExpiresAt,
            request.Password,
            request.PinnedVersion,
            ct
        );

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "ShareLink");

        var (rawToken, link) = result.Value;
        return Results.Created(
            $"/api/entries/{entryId}/share-link",
            new
            {
                link.Id,
                Token = rawToken,
                link.EntryId,
                link.ExpiresAt,
                HasPassword = link.PasswordHash is not null,
                link.PinnedVersion,
                link.AccessCount,
                link.CreatedAt,
            }
        );
    }

    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IShareLinkService shareLinkService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var result = await shareLinkService.GetByEntryIdAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "ShareLink");

        var link = result.Value;
        return Results.Ok(
            new
            {
                link.Id,
                link.EntryId,
                link.Token,
                link.ExpiresAt,
                HasPassword = link.PasswordHash is not null,
                link.PinnedVersion,
                link.AccessCount,
                link.IsActive,
                link.CreatedAt,
            }
        );
    }

    private static async Task<IResult> HandleDelete(
        Guid entryId,
        HttpContext ctx,
        IShareLinkService shareLinkService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var result = await shareLinkService.RevokeAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "ShareLink");

        return Results.NoContent();
    }
}
