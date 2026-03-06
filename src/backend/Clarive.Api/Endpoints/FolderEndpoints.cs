using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Microsoft.Extensions.Caching.Memory;
using Clarive.Api.Auth;
using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static class FolderEndpoints
{
    public static RouteGroupBuilder MapFolderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/folders")
            .WithTags("Folders")
            .RequireAuthorization();

        group.MapGet("/", HandleGetTree);

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
        IFolderRepository folderRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var cacheKey = TenantCacheKeys.FolderTree(tenantId);

        var tree = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.SetOptions(TenantCacheKeys.FolderTreeOptions);
            return await folderRepo.GetTreeAsync(tenantId, ct);
        });

        return Results.Ok(tree);
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateFolderRequest request,
        IFolderRepository folderRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        if (Validator.RequireString(request.Name, "Folder name") is { } nameErr) return nameErr;

        if (request.ParentId is not null && await folderRepo.GetByIdAsync(tenantId, request.ParentId.Value, ct) is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Parent folder not found.", "Folder", request.ParentId.Value.ToString());

        var folder = await folderRepo.CreateAsync(new Folder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            ParentId = request.ParentId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return Results.Created($"/api/folders/{folder.Id}", new FolderDto(
            folder.Id, folder.Name, folder.ParentId, []
        ));
    }

    private static async Task<IResult> HandleRename(
        Guid folderId,
        HttpContext ctx,
        RenameFolderRequest request,
        IFolderRepository folderRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Folder not found.", "Folder", folderId.ToString());

        if (Validator.RequireString(request.Name, "Folder name") is { } nameErr) return nameErr;

        folder.Name = request.Name.Trim();
        await folderRepo.UpdateAsync(folder, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return Results.Ok(new FolderDto(folder.Id, folder.Name, folder.ParentId, []));
    }

    private static async Task<IResult> HandleDelete(
        Guid folderId,
        HttpContext ctx,
        IFolderRepository folderRepo,
        IEntryRepository entryRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Folder not found.", "Folder", folderId.ToString());

        // Check for child folders
        var children = await folderRepo.GetChildrenAsync(tenantId, folderId, ct);
        if (children.Count > 0)
            return ctx.ErrorResult(409, "FOLDER_NOT_EMPTY", "Cannot delete a folder that contains subfolders.", "Folder", folderId.ToString());

        // Check for entries in folder
        var (_, entryCount) = await entryRepo.GetByFolderAsync(tenantId, folderId, includeAll: false, pageSize: 1, ct: ct);
        if (entryCount > 0)
            return ctx.ErrorResult(409, "FOLDER_NOT_EMPTY", "Cannot delete a folder that contains entries.", "Folder", folderId.ToString());

        await folderRepo.DeleteAsync(tenantId, folderId, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleMove(
        Guid folderId,
        HttpContext ctx,
        MoveFolderRequest request,
        IFolderRepository folderRepo,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var folder = await folderRepo.GetByIdAsync(tenantId, folderId, ct);
        if (folder is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Folder not found.", "Folder", folderId.ToString());

        // Cannot move to itself
        if (request.ParentId == folderId)
            return ctx.ErrorResult(409, "CIRCULAR_REFERENCE", "Cannot move a folder into itself.", "Folder", folderId.ToString());

        // Validate target parent exists
        if (request.ParentId is not null)
        {
            if (await folderRepo.GetByIdAsync(tenantId, request.ParentId.Value, ct) is null)
                return ctx.ErrorResult(404, "NOT_FOUND", "Target parent folder not found.", "Folder", request.ParentId.Value.ToString());

            // Check for circular reference
            if (await folderRepo.IsDescendantOfAsync(tenantId, request.ParentId.Value, folderId, ct))
                return ctx.ErrorResult(409, "CIRCULAR_REFERENCE", "Cannot move a folder into one of its descendants.", "Folder", folderId.ToString());
        }

        folder.ParentId = request.ParentId;
        await folderRepo.UpdateAsync(folder, ct);

        TenantCacheKeys.EvictFolderData(cache, tenantId);

        return Results.Ok(new FolderDto(folder.Id, folder.Name, folder.ParentId, []));
    }
}
