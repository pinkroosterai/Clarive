using Microsoft.AspNetCore.Hosting;
using Clarive.Auth.Jwt;
using Clarive.Infrastructure.Cache;
using System.ComponentModel;
using Clarive.Api.Helpers;
using Clarive.Domain.Enums;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Interfaces.Repositories;

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

        var items = summaries
            .Select(s => new PublicEntrySummary(
                s.Id,
                s.Title,
                s.Version,
                s.HasSystemMessage,
                s.IsTemplate,
                s.IsChain,
                s.PromptCount,
                s.FirstPromptPreview,
                s.Tags,
                s.CreatedAt,
                s.UpdatedAt
            ))
            .ToList();

        return Results.Ok(new PaginatedResponse<PublicEntrySummary>(items, totalCount, p, ps));
    }

    // ── Get single published entry ──

    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        ITagRepository tagRepo,
        TenantCacheService cache,
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

        var entryTags = await tagRepo.GetByEntryIdAsync(claims.TenantId, entryId, ct);

        var prompts = published
            .Prompts.OrderBy(p => p.Order)
            .Select(p => new PublicPrompt(
                p.Content,
                p.Order,
                p.IsTemplate,
                p.IsTemplate && p.TemplateFields.Count > 0 ? p.TemplateFields : null
            ))
            .ToList();

        return Results.Ok(
            new PublicPromptEntry(
                entry.Id,
                entry.Title,
                published.SystemMessage,
                published.Version,
                prompts,
                entryTags,
                entry.UpdatedAt,
                published.PublishedAt
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

        // Collect all template fields across all prompts, deduplicated by name.
        // GroupBy guarantees non-empty groups, so First() is always safe here.
        var allFields = published
            .Prompts.Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .GroupBy(f => f.Name)
            .Select(g => g.First())
            .ToList();

        // Validate fields
        var fields = request.Fields ?? new Dictionary<string, string>();
        var errors = TemplateFieldValidator.ValidateFields(allFields, fields);
        if (errors.Count > 0)
            return ctx.ErrorResult(
                422,
                "VALIDATION_ERROR",
                "Template field validation failed.",
                errors
            );

        // Render prompts
        var rendered = published
            .Prompts.OrderBy(p => p.Order)
            .Select(p => new RenderedPrompt(
                p.IsTemplate ? TemplateParser.Render(p.Content, fields) : p.Content,
                p.Order
            ))
            .ToList();

        // Render system message if it contains templates
        var systemMessage = published.SystemMessage;
        if (!string.IsNullOrEmpty(systemMessage))
            systemMessage = TemplateParser.Render(systemMessage, fields);

        await auditLogger.LogAsync(
            claims.TenantId,
            claims.ApiKeyId,
            claims.ApiKeyName,
            AuditAction.ApiGenerate,
            "entry",
            entry.Id,
            entry.Title,
            ct: ct
        );

        return Results.Ok(
            new PublicGenerateResponse(
                entry.Id,
                entry.Title,
                published.Version,
                systemMessage,
                rendered
            )
        );
    }

    // ── List tags ──

    private static async Task<IResult> HandleListTags(
        HttpContext ctx,
        ITagRepository tagRepo,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null)
            return claimsError!;

        var tags = await cache.GetOrCreateAsync(
            TenantCacheKeys.WorkspaceTagsKey,
            claims.TenantId,
            _ => tagRepo.GetAllWithCountsAsync(claims.TenantId, ct),
            TenantCacheKeys.WorkspaceTagsTtl,
            ct
        );

        var response = tags.Select(t => new { name = t.TagName, entryCount = t.EntryCount })
            .ToList();
        return Results.Ok(response);
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
