using Clarive.Api.Helpers;
using Clarive.Application.Entries.Contracts;
using Clarive.Application.Folders.Contracts;
using Clarive.Application.Tabs.Contracts;
using Clarive.Domain.ValueObjects;

namespace Clarive.Api.Endpoints;

/// <summary>
/// E2E seed endpoint — only registered when ASPNETCORE_ENVIRONMENT=E2E.
/// Provides fast, API-based test data creation for E2E specs.
/// </summary>
public static class SeedEndpoints
{
    public static RouteGroupBuilder MapSeedEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/e2e")
            .WithTags("E2E Seed")
            .RequireAuthorization("EditorOrAdmin");

        group.MapPost("/entries", HandleCreateEntry);
        group.MapPost("/entries/{entryId:guid}/publish", HandlePublish);
        group.MapPost("/entries/{entryId:guid}/tabs", HandleCreateTab);
        group.MapPost("/folders", HandleCreateFolder);

        return group;
    }

    private static async Task<IResult> HandleCreateEntry(
        HttpContext ctx,
        SeedCreateEntryRequest request,
        IEntryService entryService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var prompts = new List<PromptInput>
        {
            new(request.Content ?? string.Empty)
        };

        var createRequest = new CreateEntryRequest(
            request.Title,
            request.SystemMessage,
            prompts,
            request.FolderId
        );

        if (Validator.ValidateRequest(createRequest) is { } validationErr)
            return validationErr;

        var result = await entryService.CreateEntryAsync(tenantId, userId, createRequest, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (entry, version) = result.Value;
        return Results.Ok(new
        {
            entryId = entry.Id,
            tabId = version.Id,
            url = $"/entry/{entry.Id}"
        });
    }

    private static async Task<IResult> HandlePublish(
        Guid entryId,
        HttpContext ctx,
        SeedPublishRequest request,
        IEntryVersionService versionService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var userId = ctx.GetUserId();

        var result = await versionService.PublishTabAsync(
            tenantId, entryId, request.TabId, userId, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var (_, published) = result.Value;
        return Results.Ok(new
        {
            versionId = published.Id,
            version = published.Version
        });
    }

    private static async Task<IResult> HandleCreateTab(
        Guid entryId,
        HttpContext ctx,
        SeedCreateTabRequest request,
        ITabService tabService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var createRequest = new CreateTabRequest(request.Name, request.ForkedFromVersion);

        if (Validator.ValidateRequest(createRequest) is { } validationErr)
            return validationErr;

        var result = await tabService.CreateAsync(tenantId, entryId, createRequest, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new { tabId = result.Value.Id });
    }

    private static async Task<IResult> HandleCreateFolder(
        HttpContext ctx,
        SeedCreateFolderRequest request,
        IFolderService folderService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        var createRequest = new CreateFolderRequest(request.Name, request.ParentId);

        if (Validator.ValidateRequest(createRequest) is { } validationErr)
            return validationErr;

        var result = await folderService.CreateAsync(tenantId, createRequest, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new { folderId = result.Value.Id });
    }
}

// ── Request DTOs ────────────────────────────────────────────────────

public record SeedCreateEntryRequest(
    string Title,
    string? Content = null,
    string? SystemMessage = null,
    Guid? FolderId = null
);

public record SeedPublishRequest(Guid TabId);

public record SeedCreateTabRequest(
    string Name,
    int ForkedFromVersion = 1
);

public record SeedCreateFolderRequest(
    string Name,
    Guid? ParentId = null
);
