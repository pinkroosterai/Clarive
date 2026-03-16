using Clarive.Api.Auth;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
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

    private record ApiKeyClaims(Guid TenantId, Guid ApiKeyId, string ApiKeyName);

    private static (ApiKeyClaims? Claims, IResult? Error) GetApiKeyClaims(HttpContext ctx)
    {
        var tenantClaim = ctx.User.FindFirst("tenantId")?.Value;
        var apiKeyIdClaim = ctx.User.FindFirst("apiKeyId")?.Value;
        var apiKeyNameClaim = ctx.User.FindFirst("apiKeyName")?.Value;

        if (tenantClaim is null || !Guid.TryParse(tenantClaim, out var tenantId) ||
            apiKeyIdClaim is null || !Guid.TryParse(apiKeyIdClaim, out var apiKeyId) ||
            apiKeyNameClaim is null)
        {
            return (null, ctx.ErrorResult(401, "UNAUTHORIZED", "Invalid or missing API key claims."));
        }

        return (new ApiKeyClaims(tenantId, apiKeyId, apiKeyNameClaim), null);
    }

    private static async Task<IResult> HandleGet(
        Guid entryId,
        HttpContext ctx,
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null) return claimsError!;

        var result = await entryService.GetPublishedEntryAsync(claims.TenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, published) = result.Value;

        await auditLogger.LogAsync(
            claims.TenantId, claims.ApiKeyId, claims.ApiKeyName,
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
        IEntryService entryService,
        IAuditLogger auditLogger,
        CancellationToken ct)
    {
        var (claims, claimsError) = GetApiKeyClaims(ctx);
        if (claims is null) return claimsError!;

        var result = await entryService.GetPublishedEntryAsync(claims.TenantId, entryId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, published) = result.Value;

        // Collect all template fields across all prompts, deduplicated by name.
        // GroupBy guarantees non-empty groups, so First() is always safe here.
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
            claims.TenantId, claims.ApiKeyId, claims.ApiKeyName,
            AuditAction.ApiGenerate, "entry", entry.Id, entry.Title, ct: ct);

        return Results.Ok(new PublicGenerateResponse(
            entry.Id, entry.Title, published.Version,
            systemMessage, rendered));
    }

}
