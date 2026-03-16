using System.ComponentModel;
using System.Text.Json;
using System.Text.RegularExpressions;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Auth;
using Clarive.Api.Helpers;
using Microsoft.Extensions.Caching.Memory;
using Serilog;

namespace Clarive.Api.Endpoints;

public static partial class EntryEndpoints
{
    [GeneratedRegex(@"v(?:ersion\s+)?(\d+)")]
    private static partial Regex VersionPattern();

    public static RouteGroupBuilder MapEntryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/entries")
            .WithTags("Entries")
            .RequireAuthorization();

        group.MapGet("/", HandleList);
        group.MapGet("/trash", HandleListTrashed);
        group.MapGet("/{entryId:guid}", HandleGet);
        group.MapGet("/{entryId:guid}/versions", HandleGetVersions);
        group.MapGet("/{entryId:guid}/versions/{version:int}", HandleGetVersion);
        group.MapGet("/{entryId:guid}/activity", HandleGetActivity);

        // Tags
        group.MapGet("/{entryId:guid}/tags", HandleGetEntryTags);
        group.MapPost("/{entryId:guid}/tags", HandleAddTags)
            .RequireAuthorization("EditorOrAdmin");
        group.MapDelete("/{entryId:guid}/tags/{tagName}", HandleRemoveTag)
            .RequireAuthorization("EditorOrAdmin");

        // Favorites
        group.MapPost("/{entryId:guid}/favorite", HandleFavorite);
        group.MapDelete("/{entryId:guid}/favorite", HandleUnfavorite);

        group.MapPost("/", HandleCreate)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPut("/{entryId:guid}", HandleUpdate)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/publish", HandlePublish)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/versions/{version:int}/promote", HandlePromote)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/move", HandleMove)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/trash", HandleTrash)
            .RequireAuthorization("EditorOrAdmin");
        group.MapPost("/{entryId:guid}/restore", HandleRestore)
            .RequireAuthorization("EditorOrAdmin");
        group.MapDelete("/{entryId:guid}/permanent-delete", HandlePermanentDelete)
            .RequireAuthorization("AdminOnly");

        return group;
    }

    private const int MaxPageSize = 100;
    private const int DefaultPageSize = 50;
    private const int MaxActivityPageSize = 50;
    private const int DefaultActivityPageSize = 20;
    private const int MaxTagNameLength = 50;

    private static (int page, int pageSize) NormalizePagination(int? page, int? pageSize)
    {
        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0 ? Math.Min(pageSize.Value, MaxPageSize) : DefaultPageSize;
        return (p, ps);
    }

    // ── List entries ──
    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        IFavoriteRepository favoriteRepo,
        CancellationToken ct,
        string? folderId = null,
        [Description("Comma-separated tag names")] string? tags = null,
        [Description("Tag filter mode: 'and' or 'or'")] string? tagMode = null,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 100)")] int? pageSize = null,
        [Description("Search by title (case-insensitive)")] string? search = null,
        [Description("Filter by status: 'draft' or 'published'")] string? status = null,
        [Description("Sort order: 'recent', 'alphabetical', or 'oldest'")] string? sortBy = null)
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

        // Parse tag filter — compose as IQueryable subquery to avoid unbounded IN() clause
        IQueryable<Guid>? filteredEntryIds = null;
        if (!string.IsNullOrWhiteSpace(tags))
        {
            var tagList = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(t => t.ToLowerInvariant())
                .Distinct()
                .ToList();

            if (tagList.Count > 0)
            {
                var matchAll = string.Equals(tagMode, "and", StringComparison.OrdinalIgnoreCase);
                filteredEntryIds = tagRepo.GetEntryIdsByTagsQuery(tenantId, tagList, matchAll);
            }
        }

        var (p, ps) = NormalizePagination(page, pageSize);
        var (entries, totalCount) = await entryRepo.GetByFolderAsync(tenantId, parsedFolderId, includeAll, p, ps, ct, filteredEntryIds, search, status, sortBy);
        var summaries = await BuildSummariesBatchAsync(entries, entryRepo, tagRepo, favoriteRepo, tenantId, userId, ct);
        return Results.Ok(new PaginatedResponse<PromptEntrySummary>(summaries, totalCount, p, ps));
    }

    // ── List trashed ──
    private static async Task<IResult> HandleListTrashed(
        HttpContext ctx,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        IFavoriteRepository favoriteRepo,
        CancellationToken ct,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 100)")] int? pageSize = null)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var (p, ps) = NormalizePagination(page, pageSize);
        var (entries, totalCount) = await entryRepo.GetTrashedAsync(tenantId, p, ps, ct);
        var summaries = await BuildSummariesBatchAsync(entries, entryRepo, tagRepo, favoriteRepo, tenantId, userId, ct);
        return Results.Ok(new PaginatedResponse<PromptEntrySummary>(summaries, totalCount, p, ps));
    }

    // ── Get single entry (working version) ──
    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IFavoriteRepository favoriteRepo,
        IUserRepository userRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var (version, versionErr) = await GetWorkingVersionOrError(ctx, entryRepo, tenantId, entryId, ct);
        if (versionErr is not null) return versionErr;

        var isFavorited = await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct);
        return Results.Ok(await BuildFullResponseAsync(entry, version!, userRepo, tenantId, ct, isFavorited));
    }

    // ── Get version history ──
    private static async Task<IResult> HandleGetVersions(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IUserRepository userRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var versions = await entryRepo.GetVersionHistoryAsync(tenantId, entryId, ct);

        // Batch-resolve publisher GUIDs to user names
        var publisherIds = versions
            .Where(v => v.PublishedBy.HasValue)
            .Select(v => v.PublishedBy!.Value)
            .Distinct();
        var publisherMap = await userRepo.GetByIdsAsync(tenantId, publisherIds, ct);

        var versionInfos = versions.Select(v => new VersionInfo(
            v.Version,
            v.VersionState.ToString().ToLower(),
            v.PublishedAt,
            v.PublishedBy.HasValue && publisherMap.TryGetValue(v.PublishedBy.Value, out var pub) ? pub.Name : null
        )).ToList();

        return Results.Ok(versionInfos);
    }

    // ── Get specific version ──
    private static async Task<IResult> HandleGetVersion(
        Guid entryId,
        int version,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IUserRepository userRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var ver = await entryRepo.GetVersionAsync(tenantId, entryId, version, ct);
        if (ver is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Version not found.", "Entry", entryId.ToString());

        return Results.Ok(await BuildFullResponseAsync(entry, ver, userRepo, tenantId, ct));
    }

    // ── Create entry ──
    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateEntryRequest request,
        IEntryService entryService,
        IUserRepository userRepo,
        IAuditLogger auditLogger,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var error = entryService.ValidateCreateRequest(request);
        if (error is not null)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", error);

        var result = await entryService.CreateEntryAsync(tenantId, userId, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, version) = result.Value;

        TenantCacheKeys.EvictEntryData(cache, tenantId);

        await SafeLogAsync(auditLogger, tenantId, userId, ctx.GetUserName(), AuditAction.EntryCreated,
            "prompt_entry", entry.Id, entry.Title, $"Created '{entry.Title}'", ct);

        return Results.Created($"/api/entries/{entry.Id}",
            await BuildFullResponseAsync(entry, version, userRepo, tenantId, ct));
    }

    // ── Update entry (overwrite draft or create draft from published) ──
    private static async Task<IResult> HandleUpdate(
        Guid entryId,
        HttpContext ctx,
        UpdateEntryRequest request,
        IEntryService entryService,
        IUserRepository userRepo,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var error = entryService.ValidateUpdateRequest(request);
        if (error is not null)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", error);

        var result = await entryService.UpdateEntryAsync(tenantId, entryId, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var (entry, working) = result.Value;

        await SafeLogAsync(auditLogger, tenantId, userId, ctx.GetUserName(), AuditAction.EntryDraftUpdated,
            "prompt_entry", entry.Id, entry.Title, $"Updated draft v{working.Version}", ct);

        return Results.Ok(await BuildFullResponseAsync(entry, working, userRepo, tenantId, ct));
    }

    // ── Publish ──
    private static async Task<IResult> HandlePublish(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IUserRepository userRepo,
        IAuditLogger auditLogger,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await entryService.PublishDraftAsync(tenantId, entryId, userId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var (entry, published) = result.Value;

        TenantCacheKeys.EvictEntryData(cache, tenantId);

        await SafeLogAsync(auditLogger, tenantId, userId, ctx.GetUserName(), AuditAction.EntryPublished,
            "prompt_entry", entry.Id, entry.Title, $"Published version {published.Version}", ct);

        return Results.Ok(await BuildFullResponseAsync(entry, published, userRepo, tenantId, ct));
    }

    // ── Promote historical version ──
    private static async Task<IResult> HandlePromote(
        Guid entryId,
        int version,
        HttpContext ctx,
        IEntryService entryService,
        IUserRepository userRepo,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await entryService.PromoteVersionAsync(tenantId, entryId, version, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var (entry, newDraft) = result.Value;

        await SafeLogAsync(auditLogger, tenantId, userId, ctx.GetUserName(), AuditAction.VersionPromoted,
            "prompt_entry", entry.Id, entry.Title, $"Restored v{version} as new draft v{newDraft.Version}", ct);

        return Results.Ok(await BuildFullResponseAsync(entry, newDraft, userRepo, tenantId, ct));
    }

    // ── Move to folder ──
    private static async Task<IResult> HandleMove(
        Guid entryId,
        HttpContext ctx,
        MoveEntryRequest request,
        IEntryService entryService,
        IEntryRepository entryRepo,
        IUserRepository userRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.MoveEntryAsync(tenantId, entryId, request.FolderId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var entry = result.Value;

        var (version, versionErr) = await GetWorkingVersionOrError(ctx, entryRepo, tenantId, entryId, ct);
        if (versionErr is not null) return versionErr;

        return Results.Ok(await BuildFullResponseAsync(entry, version!, userRepo, tenantId, ct));
    }

    // ── Trash ──
    private static async Task<IResult> HandleTrash(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IAuditLogger auditLogger,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.TrashEntryAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        TenantCacheKeys.EvictEntryData(cache, tenantId);

        await SafeLogAsync(auditLogger, tenantId, ctx.GetUserId(), ctx.GetUserName(), AuditAction.EntryTrashed,
            "prompt_entry", entry.Id, entry.Title, $"Moved '{entry.Title}' to trash", ct);

        return Results.NoContent();
    }

    // ── Restore ──
    private static async Task<IResult> HandleRestore(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IEntryRepository entryRepo,
        IUserRepository userRepo,
        IAuditLogger auditLogger,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.RestoreEntryAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        TenantCacheKeys.EvictEntryData(cache, tenantId);

        await SafeLogAsync(auditLogger, tenantId, ctx.GetUserId(), ctx.GetUserName(), AuditAction.EntryRestored,
            "prompt_entry", entry.Id, entry.Title, $"Restored '{entry.Title}' from trash", ct);

        var (version, versionErr) = await GetWorkingVersionOrError(ctx, entryRepo, tenantId, entryId, ct);
        if (versionErr is not null) return versionErr;
        return Results.Ok(await BuildFullResponseAsync(entry, version!, userRepo, tenantId, ct));
    }

    // ── Permanent delete ──
    private static async Task<IResult> HandlePermanentDelete(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IAuditLogger auditLogger,
        IMemoryCache cache,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        var result = await entryService.DeleteEntryPermanentlyAsync(tenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx, "Entry", entryId.ToString());

        var entry = result.Value;

        TenantCacheKeys.EvictEntryData(cache, tenantId);

        await SafeLogAsync(auditLogger, tenantId, ctx.GetUserId(), ctx.GetUserName(), AuditAction.EntryDeleted,
            "prompt_entry", entryId, entry.Title, $"Permanently deleted '{entry.Title}'", ct);

        return Results.NoContent();
    }

    // ── Tags ──

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

    // ── Favorites ──

    private static async Task<IResult> HandleFavorite(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IFavoriteRepository favoriteRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        if (await favoriteRepo.ExistsAsync(tenantId, userId, entryId, ct))
            return Results.NoContent();

        await favoriteRepo.AddAsync(new EntryFavorite
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            EntryId = entryId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        return Results.NoContent();
    }

    private static async Task<IResult> HandleUnfavorite(
        Guid entryId,
        HttpContext ctx,
        IFavoriteRepository favoriteRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();
        await favoriteRepo.RemoveAsync(tenantId, userId, entryId, ct);
        return Results.NoContent();
    }

    // ── Activity ──

    private static async Task<IResult> HandleGetActivity(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IAuditLogRepository auditRepo,
        CancellationToken ct,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 50)")] int? pageSize = null)
    {
        var tenantId = ctx.GetTenantId();
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0 ? Math.Min(pageSize.Value, MaxActivityPageSize) : DefaultActivityPageSize;

        var (entries, total) = await auditRepo.GetByEntityIdAsync(tenantId, entryId, p, ps, ct);

        var items = entries.Select(a =>
        {
            // Extract version number from details if present (e.g., "Published version 2")
            int? version = null;
            if (a.Details is not null)
            {
                var match = VersionPattern().Match(a.Details);
                if (match.Success && int.TryParse(match.Groups[1].Value, out var v))
                    version = v;
            }

            return new EntryActivityItem(
                a.Id,
                JsonNamingPolicy.SnakeCaseLower.ConvertName(a.Action.ToString()),
                a.UserName,
                a.Details,
                version,
                a.Timestamp);
        }).ToList();

        return Results.Ok(new EntryActivityResponse(items, total, p, ps));
    }

    // ── Presentation Helpers ──

    private static async Task SafeLogAsync(
        IAuditLogger auditLogger,
        Guid tenantId,
        Guid userId,
        string userName,
        AuditAction action,
        string entityType,
        Guid entityId,
        string entityTitle,
        string? details,
        CancellationToken ct)
    {
        try
        {
            await auditLogger.LogAsync(tenantId, userId, userName, action, entityType, entityId, entityTitle, details, ct);
        }
        catch (Exception ex)
        {
            // Audit logging failures must not affect the primary operation
            Log.Warning(ex, "Audit logging failed for {Action} on {EntityType} {EntityId}", action, entityType, entityId);
        }
    }

    private static async Task<List<PromptEntrySummary>> BuildSummariesBatchAsync(
        List<PromptEntry> entries,
        IEntryRepository entryRepo,
        ITagRepository tagRepo,
        IFavoriteRepository favoriteRepo,
        Guid tenantId,
        Guid userId,
        CancellationToken ct)
    {
        var entryIds = entries.Select(e => e.Id).ToList();
        var workingVersions = await entryRepo.GetWorkingVersionsBatchAsync(tenantId, entryIds, ct);
        var tagsByEntry = await tagRepo.GetByEntryIdsBatchAsync(tenantId, entryIds, ct);
        var favoritedIds = await favoriteRepo.GetFavoritedEntryIdsAsync(tenantId, userId, entryIds, ct);

        return entries.Select(entry =>
        {
            workingVersions.TryGetValue(entry.Id, out var version);
            tagsByEntry.TryGetValue(entry.Id, out var tags);
            return PromptEntrySummary.FromEntryAndVersion(entry, version, tags, favoritedIds.Contains(entry.Id));
        }).ToList();
    }

    private static async Task<object> BuildFullResponseAsync(
        PromptEntry entry,
        PromptEntryVersion version,
        IUserRepository userRepo,
        Guid tenantId,
        CancellationToken ct,
        bool? isFavorited = null)
    {
        var userIds = new HashSet<Guid> { entry.CreatedBy };
        if (version.PublishedBy.HasValue) userIds.Add(version.PublishedBy.Value);
        var users = await userRepo.GetByIdsAsync(tenantId, userIds, ct);

        var creatorName = users.TryGetValue(entry.CreatedBy, out var creator) ? creator.Name : null;
        var publisherName = version.PublishedBy.HasValue && users.TryGetValue(version.PublishedBy.Value, out var publisher)
            ? publisher.Name : null;

        return new
        {
            entry.Id,
            entry.Title,
            version.SystemMessage,
            Prompts = version.Prompts.OrderBy(p => p.Order).Select(p => new
            {
                p.Id,
                p.Content,
                p.Order,
                p.IsTemplate,
                TemplateFields = p.TemplateFields.Select(tf => new
                {
                    tf.Id,
                    tf.Name,
                    tf.Type,
                    tf.EnumValues,
                    tf.DefaultValue,
                    tf.Min,
                    tf.Max
                })
            }),
            entry.FolderId,
            version.Version,
            VersionState = version.VersionState.ToString().ToLower(),
            entry.IsTrashed,
            entry.CreatedAt,
            entry.UpdatedAt,
            CreatedBy = creatorName ?? entry.CreatedBy.ToString(),
            version.PublishedAt,
            PublishedBy = publisherName,
            IsFavorited = isFavorited ?? false
        };
    }

    private static async Task<(PromptEntryVersion? version, IResult? error)> GetWorkingVersionOrError(
        HttpContext ctx, IEntryRepository entryRepo, Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return (null, ctx.ErrorResult(404, "NOT_FOUND", "No version found for this entry.", "Entry", entryId.ToString()));
        return (version, null);
    }
}
