using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Auth;

namespace Clarive.Api.Endpoints;

public static class FolderEndpoints
{
    public static RouteGroupBuilder MapFolderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/folders")
            .WithTags("Folders")
            .RequireAuthorization();

        group.MapGet("/", HandleGetTree).AddEndpointFilter(new CacheControlFilter(60));

        group.MapPost("/", HandleCreate)
            .RequireAuthorization("EditorOrAdmin");

        group.MapPatch("/{folderId:guid}", HandleRename)
            .RequireAuthorization("EditorOrAdmin");

        group.MapDelete("/{folderId:guid}", HandleDelete)
            .RequireAuthorization("EditorOrAdmin");

        group.MapPost("/{folderId:guid}/move", HandleMove)
            .RequireAuthorization("EditorOrAdmin");

        return group;
    }

    private static async Task<IResult> HandleGetTree(
        HttpContext ctx,
        IFolderService folderService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await folderService.GetTreeAsync(tenantId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateFolderRequest request,
        IFolderService folderService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        if (Validator.ValidateRequest(request) is { } validationErr) return validationErr;

        var result = await folderService.CreateAsync(tenantId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var folder = result.Value;
        return Results.Created($"/api/folders/{folder.Id}", new FolderDto(
            folder.Id, folder.Name, folder.ParentId, []
        ));
    }

    private static async Task<IResult> HandleRename(
        Guid folderId,
        HttpContext ctx,
        RenameFolderRequest request,
        IFolderService folderService,
        CancellationToken ct)
    {
        if (Validator.ValidateRequest(request) is { } validationErr) return validationErr;

        var tenantId = ctx.GetTenantId();
        var result = await folderService.RenameAsync(tenantId, folderId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var folder = result.Value;
        return Results.Ok(new FolderDto(folder.Id, folder.Name, folder.ParentId, []));
    }

    private static async Task<IResult> HandleDelete(
        Guid folderId,
        HttpContext ctx,
        IFolderService folderService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await folderService.DeleteAsync(tenantId, folderId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleMove(
        Guid folderId,
        HttpContext ctx,
        MoveFolderRequest request,
        IFolderService folderService,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var result = await folderService.MoveAsync(tenantId, folderId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var folder = result.Value;
        return Results.Ok(new FolderDto(folder.Id, folder.Name, folder.ParentId, []));
    }
}
