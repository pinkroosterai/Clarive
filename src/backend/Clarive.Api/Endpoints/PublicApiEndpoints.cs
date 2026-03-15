using Clarive.Api.Auth;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;
using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static class PublicApiEndpoints
{
    public static RouteGroupBuilder MapPublicApiEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/public/v1/entries")
            .WithTags("Public API")
            .RequireAuthorization(policy =>
            {
                policy.AuthenticationSchemes = [ApiKeyAuthHandler.SchemeName];
                policy.RequireAuthenticatedUser();
            })
            .RequireRateLimiting("auth");

        group.MapGet("/{entryId:guid}", HandleGet);
        group.MapPost("/{entryId:guid}/generate", HandleGenerate);

        return group;
    }

    private static Guid GetApiKeyTenantId(HttpContext ctx)
        => Guid.Parse((ctx.User.FindFirst("tenantId")
                        ?? throw new InvalidOperationException("Missing 'tenantId' claim.")).Value);

    private static Guid GetApiKeyId(HttpContext ctx)
        => Guid.Parse((ctx.User.FindFirst("apiKeyId")
                        ?? throw new InvalidOperationException("Missing 'apiKeyId' claim.")).Value);

    private static string GetApiKeyName(HttpContext ctx)
        => (ctx.User.FindFirst("apiKeyName")
            ?? throw new InvalidOperationException("Missing 'apiKeyName' claim.")).Value;

    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IEntryRepository entryRepo,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = GetApiKeyTenantId(ctx);
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);

        if (entry is null || entry.IsTrashed)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return ctx.ErrorResult(404, "NOT_PUBLISHED", "This entry has no published version.", "Entry", entryId.ToString());

        await auditLogger.LogAsync(
            tenantId, GetApiKeyId(ctx), GetApiKeyName(ctx),
            AuditAction.ApiGet, "entry", entry.Id, entry.Title, ct: ct);

        var prompts = published.Prompts
            .OrderBy(p => p.Order)
            .Select(p => new PublicPrompt(
                p.Content, p.Order, p.IsTemplate,
                p.IsTemplate && p.TemplateFields.Count > 0 ? p.TemplateFields : null))
            .ToList();

        return Results.Ok(new PublicPromptEntry(
            entry.Id, entry.Title, published.SystemMessage,
            published.Version, prompts));
    }

    private static async Task<IResult> HandleGenerate(
        Guid entryId,
        HttpContext ctx,
        PublicGenerateRequest request,
        IEntryRepository entryRepo,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var tenantId = GetApiKeyTenantId(ctx);
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);

        if (entry is null || entry.IsTrashed)
            return ctx.ErrorResult(404, "NOT_FOUND", "Entry not found.", "Entry", entryId.ToString());

        var published = await entryRepo.GetPublishedVersionAsync(tenantId, entryId, ct);
        if (published is null)
            return ctx.ErrorResult(404, "NOT_PUBLISHED", "This entry has no published version.", "Entry", entryId.ToString());

        // Collect all template fields across all prompts
        var allFields = published.Prompts
            .Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .GroupBy(f => f.Name)
            .Select(g => g.First())
            .ToList();

        // Validate fields
        var fields = request.Fields ?? new Dictionary<string, string>();
        var errors = TemplateFieldValidator.ValidateFields(allFields, fields);
        if (errors.Count > 0)
            return Results.Json(
                new ErrorResponse(new("VALIDATION_ERROR", "Template field validation failed.", errors)),
                statusCode: 422);

        // Render prompts
        var rendered = published.Prompts
            .OrderBy(p => p.Order)
            .Select(p => new RenderedPrompt(
                p.IsTemplate ? TemplateParser.Render(p.Content, fields) : p.Content,
                p.Order))
            .ToList();

        // Render system message if it contains templates
        var systemMessage = published.SystemMessage;
        if (!string.IsNullOrEmpty(systemMessage))
            systemMessage = TemplateParser.Render(systemMessage, fields);

        await auditLogger.LogAsync(
            tenantId, GetApiKeyId(ctx), GetApiKeyName(ctx),
            AuditAction.ApiGenerate, "entry", entry.Id, entry.Title, ct: ct);

        return Results.Ok(new PublicGenerateResponse(
            entry.Id, entry.Title, published.Version,
            systemMessage, rendered));
    }

}
