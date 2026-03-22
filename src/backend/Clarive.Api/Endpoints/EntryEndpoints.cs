using System.ComponentModel;
using Clarive.Api.Helpers;
using Clarive.Application.Entries.Contracts;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Application.Audit.Services;
using Clarive.Domain.ValueObjects;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    public static RouteGroupBuilder MapEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/entries").WithTags("Entries").RequireAuthorization();

        group.MapGet("/", HandleList);
        group.MapGet("/tree", HandleGetTree);
        group.MapGet("/trash", HandleListTrashed);
        group.MapGet("/{entryId:guid}", HandleGet);
        group.MapGet("/{entryId:guid}/versions", HandleGetVersions);
        group.MapGet("/{entryId:guid}/versions/{version:int}", HandleGetVersion);
        group.MapGet("/{entryId:guid}/activity", HandleGetActivity);

        // Tags
        group.MapGet("/{entryId:guid}/tags", HandleGetEntryTags);
        group.MapPost("/{entryId:guid}/tags", HandleAddTags).RequireAuthorization("EditorOrAdmin");
        group
            .MapDelete("/{entryId:guid}/tags/{tagName}", HandleRemoveTag)
            .RequireAuthorization("EditorOrAdmin");

        // Favorites
        group.MapPost("/{entryId:guid}/favorite", HandleFavorite);
        group.MapDelete("/{entryId:guid}/favorite", HandleUnfavorite);

        group.MapPost("/", HandleCreate).RequireAuthorization("EditorOrAdmin");
        group.MapPut("/{entryId:guid}", HandleUpdate).RequireAuthorization("EditorOrAdmin");
        group
            .MapPost("/{entryId:guid}/publish", HandlePublish)
            .RequireAuthorization("EditorOrAdmin");
        group
            .MapPost("/{entryId:guid}/versions/{version:int}/promote", HandlePromote)
            .RequireAuthorization("EditorOrAdmin");
        group
            .MapDelete("/{entryId:guid}/draft", HandleDeleteDraft)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/move", HandleMove).RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/trash", HandleTrash).RequireAuthorization("EditorOrAdmin");
        group
            .MapPost("/{entryId:guid}/restore", HandleRestore)
            .RequireAuthorization("EditorOrAdmin");
        group
            .MapDelete("/{entryId:guid}/permanent-delete", HandlePermanentDelete)
            .RequireAuthorization("AdminOnly");

        return group;
    }

    private const int MaxPageSize = 100;
    private const int DefaultPageSize = 50;
    private const int MaxActivityPageSize = 50;
    private const int DefaultActivityPageSize = 20;

    private static (int page, int pageSize) NormalizePagination(int? page, int? pageSize)
    {
        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0 ? Math.Min(pageSize.Value, MaxPageSize) : DefaultPageSize;
        return (p, ps);
    }

    // ── Tree (minimal sidebar data) ──
    private static async Task<IResult> HandleGetTree(
        HttpContext ctx,
        IEntryRepository entryRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var items = await entryRepo.GetTreeAsync(tenantId, ct);
        var dtos = items.Select(i => new EntryTreeItemDto(i.Id, i.Title, i.FolderId));
        return Results.Ok(dtos);
    }

    // ── List entries ──
    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct,
        string? folderId = null,
        [Description("Comma-separated tag names")] string? tags = null,
        [Description("Tag filter mode: 'and' or 'or'")] string? tagMode = null,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 100)")] int? pageSize = null,
        [Description("Search by title (case-insensitive)")] string? search = null,
        [Description("Filter by status: 'draft' or 'published'")] string? status = null,
        [Description("Sort order: 'recent', 'alphabetical', or 'oldest'")] string? sortBy = null
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        bool includeAll = string.Equals(folderId, "all", StringComparison.OrdinalIgnoreCase);
        Guid? parsedFolderId = null;

        if (!includeAll && folderId is not null)
        {
            if (!Guid.TryParse(folderId, out var gid))
                return ctx.ErrorResult(422, "VALIDATION_ERROR", "Invalid folderId.");
            parsedFolderId = gid;
        }

        var (p, ps) = NormalizePagination(page, pageSize);
        var result = await entryService.ListEntriesAsync(
            tenantId,
            userId,
            parsedFolderId,
            includeAll,
            tags,
            tagMode,
            p,
            ps,
            search,
            status,
            sortBy,
            ct
        );
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (summaries, totalCount) = result.Value;
        return Results.Ok(new PaginatedResponse<PromptEntryDto>(summaries, totalCount, p, ps));
    }

    // ── List trashed ──
    private static async Task<IResult> HandleListTrashed(
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 100)")] int? pageSize = null
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var (p, ps) = NormalizePagination(page, pageSize);
        var result = await entryService.ListTrashedEntriesAsync(tenantId, userId, p, ps, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (summaries, totalCount) = result.Value;
        return Results.Ok(new PaginatedResponse<PromptEntryDto>(summaries, totalCount, p, ps));
    }

    // ── Get single entry (working version) ──
    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var result = await entryService.GetEntryDetailAsync(tenantId, userId, entryId, ct);
        return result.IsError
            ? result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString())
            : Results.Ok(result.Value);
    }

    // ── Get version history ──
    private static async Task<IResult> HandleGetVersions(
        Guid entryId,
        HttpContext ctx,
        IEntryVersionService versionService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await versionService.GetVersionHistoryAsync(tenantId, entryId, ct);
        return result.IsError
            ? result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString())
            : Results.Ok(result.Value);
    }

    // ── Get specific version ──
    private static async Task<IResult> HandleGetVersion(
        Guid entryId,
        int version,
        HttpContext ctx,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await entryService.GetVersionDetailAsync(tenantId, entryId, version, ct);
        return result.IsError
            ? result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString())
            : Results.Ok(result.Value);
    }

    // ── Create entry ──
    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateEntryRequest request,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var result = await entryService.CreateEntryAsync(tenantId, userId, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, version) = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            userId,
            ctx.GetUserName(),
            AuditAction.EntryCreated,
            "prompt_entry",
            entry.Id,
            entry.Title,
            $"Created '{entry.Title}'",
            ct
        );

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            version,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Created($"/api/entries/{entry.Id}", responseResult.Value);
    }

    // ── Update entry (overwrite draft or create draft from published) ──
    private static async Task<IResult> HandleUpdate(
        Guid entryId,
        HttpContext ctx,
        UpdateEntryRequest request,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        if (Validator.ValidateRequest(request) is { } validationErr)
            return validationErr;

        var result = await entryService.UpdateEntryAsync(tenantId, entryId, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var (entry, working) = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            userId,
            ctx.GetUserName(),
            AuditAction.EntryDraftUpdated,
            "prompt_entry",
            entry.Id,
            entry.Title,
            $"Updated draft v{working.Version}",
            ct
        );

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            working,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Ok(responseResult.Value);
    }

    // ── Publish ──
    private static async Task<IResult> HandlePublish(
        Guid entryId,
        HttpContext ctx,
        IEntryVersionService versionService,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await versionService.PublishDraftAsync(tenantId, entryId, userId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var (entry, published) = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            userId,
            ctx.GetUserName(),
            AuditAction.EntryPublished,
            "prompt_entry",
            entry.Id,
            entry.Title,
            $"Published version {published.Version}",
            ct
        );

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            published,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Ok(responseResult.Value);
    }

    // ── Promote historical version ──
    private static async Task<IResult> HandlePromote(
        Guid entryId,
        int version,
        HttpContext ctx,
        IEntryVersionService versionService,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await versionService.PromoteVersionAsync(tenantId, entryId, version, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var (entry, newDraft) = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            userId,
            ctx.GetUserName(),
            AuditAction.VersionPromoted,
            "prompt_entry",
            entry.Id,
            entry.Title,
            $"Restored v{version} as new draft v{newDraft.Version}",
            ct
        );

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            newDraft,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Ok(responseResult.Value);
    }

    // ── Delete draft ──
    private static async Task<IResult> HandleDeleteDraft(
        Guid entryId,
        HttpContext ctx,
        IEntryVersionService versionService,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await versionService.DeleteDraftAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            userId,
            ctx.GetUserName(),
            AuditAction.DraftDeleted,
            "prompt_entry",
            entry.Id,
            entry.Title,
            "Deleted draft, reverted to published version",
            ct
        );

        var versionResult = await entryService.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (versionResult.IsError)
            return versionResult.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            versionResult.Value,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Ok(responseResult.Value);
    }

    // ── Move to folder ──
    private static async Task<IResult> HandleMove(
        Guid entryId,
        HttpContext ctx,
        MoveEntryRequest request,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.MoveEntryAsync(tenantId, entryId, request.FolderId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var entry = result.Value;

        var versionResult = await entryService.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (versionResult.IsError)
            return versionResult.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            versionResult.Value,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Ok(responseResult.Value);
    }

    // ── Trash ──
    private static async Task<IResult> HandleTrash(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.TrashEntryAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            ctx.GetUserId(),
            ctx.GetUserName(),
            AuditAction.EntryTrashed,
            "prompt_entry",
            entry.Id,
            entry.Title,
            $"Moved '{entry.Title}' to trash",
            ct
        );

        return Results.NoContent();
    }

    // ── Restore ──
    private static async Task<IResult> HandleRestore(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.RestoreEntryAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            ctx.GetUserId(),
            ctx.GetUserName(),
            AuditAction.EntryRestored,
            "prompt_entry",
            entry.Id,
            entry.Title,
            $"Restored '{entry.Title}' from trash",
            ct
        );

        var versionResult = await entryService.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (versionResult.IsError)
            return versionResult.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var responseResult = await entryService.BuildEntryResponseAsync(
            entry,
            versionResult.Value,
            tenantId,
            false,
            ct
        );
        return responseResult.IsError
            ? responseResult.Errors.ToHttpResult(ctx)
            : Results.Ok(responseResult.Value);
    }

    // ── Permanent delete ──
    private static async Task<IResult> HandlePermanentDelete(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.DeleteEntryPermanentlyAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        await auditLogger.SafeLogAsync(
            tenantId,
            ctx.GetUserId(),
            ctx.GetUserName(),
            AuditAction.EntryDeleted,
            "prompt_entry",
            entryId,
            entry.Title,
            $"Permanently deleted '{entry.Title}'",
            ct
        );

        return Results.NoContent();
    }
}
