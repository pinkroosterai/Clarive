using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.AspNetCore.Hosting;
using Clarive.Auth.Jwt;
using Clarive.Application.Common;
using Clarive.Application.Tags.Contracts;
using Clarive.Application.Tabs.Contracts;
using System.ComponentModel;
using Clarive.Api.Helpers;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;

namespace Clarive.Api.Endpoints;

public static class PublicApiEndpoints
{
    private const int MaxPageSize = 100;
    private const int DefaultPageSize = 50;

    public static IEndpointRouteBuilder MapPublicApiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/public/v1")
            .WithTags("Public API")
            .RequireAuthorization(policy =>
            {
                policy.AuthenticationSchemes = [ApiKeyAuthHandler.SchemeName];
                policy.RequireAuthenticatedUser();
            })
            .DisableRateLimiting(); // Rate limiting handled by PublicApiRateLimitMiddleware

        // Entries
        group.MapGet("/entries", HandleList);
        group.MapGet("/entries/{entryId:guid}", HandleGet);
        group.MapPost("/entries/{entryId:guid}/generate", HandleGenerate);

        // Tabs (read-only)
        group.MapGet("/entries/{entryId:guid}/tabs", HandleListTabs).AddEndpointFilter(new CacheControlFilter(300));
        group.MapGet("/entries/{entryId:guid}/tabs/{tabId:guid}", HandleGetTab);
        group.MapPost("/entries/{entryId:guid}/tabs/{tabId:guid}/generate", HandleGenerateTab);

        // Tags
        group.MapGet("/tags", HandleListTags).AddEndpointFilter(new CacheControlFilter(300));

        // OpenAPI spec
        group.MapGet("/openapi.json", HandleOpenApiSpec).ExcludeFromDescription();

        return app;
    }

    private record ApiKeyClaims(Guid TenantId, Guid ApiKeyId, string ApiKeyName);

    private static (ApiKeyClaims? Claims, IResult? Error) GetApiKeyClaims(HttpContext ctx)
    {
        var tenantClaim = ctx.User.FindFirst("tenantId")?.Value;
        var apiKeyIdClaim = ctx.User.FindFirst("apiKeyId")?.Value;
        var apiKeyNameClaim = ctx.User.FindFirst("apiKeyName")?.Value;

        if (
            tenantClaim is null
            || !Guid.TryParse(tenantClaim, out var tenantId)
            || apiKeyIdClaim is null
            || !Guid.TryParse(apiKeyIdClaim, out var apiKeyId)
            || apiKeyNameClaim is null
        )
        {
            return (
                null,
                ctx.ErrorResult(401, "UNAUTHORIZED", "Invalid or missing API key claims.")
            );
        }

        return (new ApiKeyClaims(tenantId, apiKeyId, apiKeyNameClaim), null);
    }

    private static (int page, int pageSize) NormalizePagination(int? page, int? pageSize)
    {
        var p = page is > 0 ? page.Value : 1;
        var ps = pageSize is > 0 ? Math.Min(pageSize.Value, MaxPageSize) : DefaultPageSize;
        return (p, ps);
    }

    // ── List published entries ──

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IEntryService entryService,
        IEntryRepository entryRepo,
        CancellationToken ct,
        [Description("Folder ID to filter by, or 'all' for all folders")] string? folderId = null,
        [Description("Comma-separated tag names")] string? tags = null,
        [Description("Tag filter mode: 'and' or 'or'")] string? tagMode = null,
        [Description("Page number (1-based)")] int? page = null,
        [Description("Items per page (max 100)")] int? pageSize = null,
        [Description("Search by title (case-insensitive)")] string? search = null,
        [Description("Sort order: 'recent', 'alphabetical', or 'oldest'")] string? sortBy = null
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        bool includeAll = string.Equals(folderId, "all", StringComparison.OrdinalIgnoreCase);
        Guid? parsedFolderId = null;

        if (!includeAll && folderId is not null)
        {
            if (!Guid.TryParse(folderId, out var gid))
                return ctx.ErrorResult(422, "VALIDATION_ERROR", "Invalid folderId.");
            parsedFolderId = gid;
        }

        var (p, ps) = NormalizePagination(page, pageSize);

        // Force status=published — the public API only exposes published entries
        var result = await entryService.ListEntriesAsync(
            claims.TenantId,
            Guid.Empty,
            parsedFolderId,
            includeAll || folderId is null,
            tags,
            tagMode,
            p,
            ps,
            search,
            "published",
            sortBy,
            ct
        );
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (summaries, totalCount) = result.Value;

        // Batch-load tabs for all entries in one query (avoids N+1)
        var entryIds = summaries.Select(s => s.Id).ToList();
        var tabsByEntry = await entryRepo.GetTabsBatchAsync(claims.TenantId, entryIds, ct);

        var items = summaries
            .Select(s =>
            {
                var tabs = tabsByEntry.TryGetValue(s.Id, out var entryTabs)
                    ? MapTabSummaries(entryTabs)
                    : [];
                return new PublicEntrySummary(
                    s.Id, s.Title, s.Version, s.HasSystemMessage, s.IsTemplate, s.IsChain,
                    s.PromptCount, s.FirstPromptPreview, s.Tags, s.CreatedAt, s.UpdatedAt,
                    tabs, tabs.Count
                );
            })
            .ToList();

        return Results.Ok(new PaginatedResponse<PublicEntrySummary>(items, totalCount, p, ps));
    }

    // ── Get single published entry ──

    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        ITabService tabService,
        ITagService tagService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var result = await entryService.GetPublishedEntryAsync(claims.TenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, published) = result.Value;

        await auditLogger.LogAsync(
            claims.TenantId,
            claims.ApiKeyId,
            claims.ApiKeyName,
            AuditAction.ApiGet,
            "entry",
            entry.Id,
            entry.Title,
            ct: ct
        );

        var entryTags = await tagService.GetByEntryIdAsync(claims.TenantId, entryId, ct);
        var tabs = await LoadTabSummariesAsync(tabService, claims.TenantId, entryId, ct);

        var prompts = MapPublicPrompts(published);

        return Results.Ok(
            new PublicPromptEntry(
                entry.Id, entry.Title, published.SystemMessage, published.Version,
                prompts, entryTags, entry.UpdatedAt, published.PublishedAt, tabs, tabs.Count
            )
        );
    }

    // ── Generate (render templates) ──

    private static async Task<IResult> HandleGenerate(
        Guid entryId,
        HttpContext ctx,
        PublicGenerateRequest request,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var result = await entryService.GetPublishedEntryAsync(claims.TenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, published) = result.Value;

        var validationError = ValidateTemplateFields(published, request, ctx, out var fields);
        if (validationError is not null)
            return validationError;

        var (rendered, systemMessage) = RenderVersion(published, fields);

        await auditLogger.LogAsync(
            claims.TenantId, claims.ApiKeyId, claims.ApiKeyName,
            AuditAction.ApiGenerate, "entry", entry.Id, entry.Title, ct: ct
        );

        return Results.Ok(
            new PublicGenerateResponse(entry.Id, entry.Title, published.Version, systemMessage, rendered)
        );
    }

    // ── List tags ──

    private static async Task<IResult> HandleListTags(
        HttpContext ctx,
        ITagService tagService,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var tags = await tagService.GetAllAsync(claims.TenantId, ct);
        var response = tags.Select(t => new { name = t.Name, entryCount = t.EntryCount })
            .ToList();
        return Results.Ok(response);
    }

    // ── Get single tab ──

    private static async Task<IResult> HandleGetTab(
        Guid entryId,
        Guid tabId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        ITabService tabService,
        ITagService tagService,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var entry = await entryRepo.GetByIdAsync(claims.TenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return ctx.ErrorResult(404, "ENTRY_NOT_FOUND", "Entry not found.");

        var tab = await entryRepo.GetVersionByIdAsync(claims.TenantId, tabId, ct);
        if (tab is null || tab.EntryId != entryId || tab.VersionState != VersionState.Tab)
            return ctx.ErrorResult(404, "TAB_NOT_FOUND", "Tab not found.");

        await auditLogger.LogAsync(
            claims.TenantId, claims.ApiKeyId, claims.ApiKeyName,
            AuditAction.ApiGetTab, "entry", entry.Id, entry.Title, ct: ct
        );

        var entryTags = await tagService.GetByEntryIdAsync(claims.TenantId, entryId, ct);
        var tabs = await LoadTabSummariesAsync(tabService, claims.TenantId, entryId, ct);
        var prompts = MapPublicPrompts(tab);

        return Results.Ok(
            new PublicPromptEntry(
                entry.Id, entry.Title, tab.SystemMessage, tab.Version,
                prompts, entryTags, entry.UpdatedAt, tab.PublishedAt, tabs, tabs.Count
            )
        );
    }

    // ── Generate (render templates) from a tab ──

    private static async Task<IResult> HandleGenerateTab(
        Guid entryId,
        Guid tabId,
        HttpContext ctx,
        PublicGenerateRequest request,
        IEntryRepository entryRepo,
        IAuditLogger auditLogger,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var entry = await entryRepo.GetByIdAsync(claims.TenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return ctx.ErrorResult(404, "ENTRY_NOT_FOUND", "Entry not found.");

        var tab = await entryRepo.GetVersionByIdAsync(claims.TenantId, tabId, ct);
        if (tab is null || tab.EntryId != entryId || tab.VersionState != VersionState.Tab)
            return ctx.ErrorResult(404, "TAB_NOT_FOUND", "Tab not found.");

        var validationError = ValidateTemplateFields(tab, request, ctx, out var fields);
        if (validationError is not null)
            return validationError;

        var (rendered, systemMessage) = RenderVersion(tab, fields);

        await auditLogger.LogAsync(
            claims.TenantId, claims.ApiKeyId, claims.ApiKeyName,
            AuditAction.ApiGenerateTab, "entry", entry.Id, entry.Title, ct: ct
        );

        return Results.Ok(
            new PublicGenerateResponse(entry.Id, entry.Title, tab.Version, systemMessage, rendered)
        );
    }

    // ── List tabs for an entry ──

    private static async Task<IResult> HandleListTabs(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        ITabService tabService,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var entry = await entryRepo.GetByIdAsync(claims.TenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return ctx.ErrorResult(404, "ENTRY_NOT_FOUND", "Entry not found.");

        var tabs = await LoadTabSummariesAsync(tabService, claims.TenantId, entryId, ct);
        return Results.Ok(tabs);
    }

    // ── Shared helpers ──

    private static List<PublicTabSummary> MapTabSummaries(List<PromptEntryVersion> tabs) =>
        tabs.Select(t => new PublicTabSummary(t.Id, t.TabName ?? "Main", t.IsMainTab, t.ForkedFromVersion)).ToList();

    private static async Task<List<PublicTabSummary>> LoadTabSummariesAsync(
        ITabService tabService, Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var result = await tabService.ListAsync(tenantId, entryId, ct);
        return result.IsError
            ? []
            : result.Value
                .Select(t => new PublicTabSummary(t.Id, t.Name, t.IsMainTab, t.ForkedFromVersion))
                .ToList();
    }

    private static List<PublicPrompt> MapPublicPrompts(PromptEntryVersion version) =>
        version.Prompts.OrderBy(p => p.Order)
            .Select(p => new PublicPrompt(
                p.Content, p.Order, p.IsTemplate,
                p.IsTemplate && p.TemplateFields.Count > 0 ? p.TemplateFields : null
            ))
            .ToList();

    private static IResult? ValidateTemplateFields(
        PromptEntryVersion version, PublicGenerateRequest request, HttpContext ctx,
        out Dictionary<string, string> fields)
    {
        // Collect all template fields across all prompts, deduplicated by name.
        var allFields = version.Prompts.Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .GroupBy(f => f.Name)
            .Select(g => g.First())
            .ToList();

        fields = request.Fields ?? new Dictionary<string, string>();
        var errors = TemplateFieldValidator.ValidateFields(allFields, fields);
        if (errors.Count > 0)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Template field validation failed.", errors);
        return null;
    }

    private static (List<RenderedPrompt> Rendered, string? SystemMessage) RenderVersion(
        PromptEntryVersion version, Dictionary<string, string> fields)
    {
        var rendered = version.Prompts.OrderBy(p => p.Order)
            .Select(p => new RenderedPrompt(
                p.IsTemplate ? TemplateParser.Render(p.Content, fields) : p.Content, p.Order
            ))
            .ToList();

        var systemMessage = version.SystemMessage;
        if (!string.IsNullOrEmpty(systemMessage))
            systemMessage = TemplateParser.Render(systemMessage, fields);

        return (rendered, systemMessage);
    }

    // ── Serve OpenAPI spec ──

    private static async Task<IResult> HandleOpenApiSpec(
        HttpContext ctx,
        IWebHostEnvironment env,
        CancellationToken ct
    )
    {
        // In Docker: /app/docs/api-reference.yaml
        // In dev:    {ContentRootPath}/../../../docs/api-reference.yaml
        var candidates = new[]
        {
            Path.Combine(env.ContentRootPath, "docs", "api-reference.yaml"),
            Path.GetFullPath(
                Path.Combine(env.ContentRootPath, "..", "..", "..", "docs", "api-reference.yaml")
            ),
        };

        var specPath = candidates.FirstOrDefault(File.Exists);
        if (specPath is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "OpenAPI specification not found.");

        var content = await File.ReadAllTextAsync(specPath, ct);
        return Results.Content(content, "application/x-yaml");
    }
}
