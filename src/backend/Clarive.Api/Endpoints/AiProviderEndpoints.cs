using Clarive.Infrastructure.Cache;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Requests;
using Clarive.Domain.ValueObjects;
using Clarive.Api.Services;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Endpoints;

public static class AiProviderEndpoints
{
    public static RouteGroupBuilder MapAiProviderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/super/ai-providers")
            .WithTags("AI Providers")
            .RequireAuthorization("SuperUser");

        group.MapGet("/", HandleGetAll);
        group.MapPost("/", HandleCreate);
        group.MapPatch("/{id:guid}", HandleUpdate);
        group.MapDelete("/{id:guid}", HandleDelete);
        group.MapPost("/{id:guid}/fetch-models", HandleFetchModels);
        group.MapPost("/{id:guid}/validate", HandleValidate);
        group.MapPost("/{id:guid}/models", HandleAddModel);
        group.MapPatch("/{providerId:guid}/models/{modelId:guid}", HandleUpdateModel);
        group.MapDelete("/{providerId:guid}/models/{modelId:guid}", HandleDeleteModel);

        return group;
    }

    private static async Task<IResult> HandleGetAll(
        IAiProviderService service,
        CancellationToken ct
    )
    {
        var providers = await service.GetAllAsync(ct);
        return Results.Ok(providers);
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateAiProviderRequest request,
        IAiProviderService service,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } err)
            return err;

        var result = await service.CreateAsync(request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await TenantCacheKeys.EvictAiData(cache);
        return Results.Created($"/api/super/ai-providers/{result.Value.Id}", result.Value);
    }

    private static async Task<IResult> HandleUpdate(
        Guid id,
        HttpContext ctx,
        UpdateAiProviderRequest request,
        IAiProviderService service,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var result = await service.UpdateAsync(id, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await TenantCacheKeys.EvictAiData(cache);
        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleDelete(
        Guid id,
        HttpContext ctx,
        IAiProviderService service,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var result = await service.DeleteAsync(id, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await TenantCacheKeys.EvictAiData(cache);
        return Results.NoContent();
    }

    private static async Task<IResult> HandleFetchModels(
        Guid id,
        HttpContext ctx,
        IAiProviderService service,
        CancellationToken ct
    )
    {
        var result = await service.FetchModelsAsync(id, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleValidate(
        Guid id,
        HttpContext ctx,
        IAiProviderService service,
        CancellationToken ct
    )
    {
        var result = await service.ValidateAsync(id, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        return Results.Ok(new { valid = true });
    }

    private static async Task<IResult> HandleAddModel(
        Guid id,
        HttpContext ctx,
        AddAiProviderModelRequest request,
        IAiProviderService service,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        if (Validator.ValidateRequest(request) is { } err)
            return err;

        var result = await service.AddModelAsync(id, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await TenantCacheKeys.EvictAiData(cache);
        return Results.Created(
            $"/api/super/ai-providers/{id}/models/{result.Value.Id}",
            result.Value
        );
    }

    private static async Task<IResult> HandleUpdateModel(
        Guid modelId,
        HttpContext ctx,
        UpdateAiProviderModelRequest request,
        IAiProviderService service,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var result = await service.UpdateModelAsync(modelId, request, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await TenantCacheKeys.EvictAiData(cache);
        return Results.Ok(result.Value);
    }

    private static async Task<IResult> HandleDeleteModel(
        Guid modelId,
        HttpContext ctx,
        IAiProviderService service,
        TenantCacheService cache,
        CancellationToken ct
    )
    {
        var result = await service.DeleteModelAsync(modelId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        await TenantCacheKeys.EvictAiData(cache);
        return Results.NoContent();
    }
}
