using Clarive.Application.ApiKeys;
using Clarive.Application.ApiKeys.Contracts;
using Clarive.Api.Helpers;

namespace Clarive.Api.Endpoints;

public static class ApiKeyEndpoints
{
    public static RouteGroupBuilder MapApiKeyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/api-keys")
            .WithTags("API Keys")
            .RequireAuthorization("AdminOnly");

        group.MapGet("/", HandleList);
        group.MapPost("/", HandleCreate);
        group.MapDelete("/{keyId:guid}", HandleDelete);

        return group;
    }

    private static async Task<IResult> HandleList(
        HttpContext ctx,
        IApiKeyService apiKeyService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var keys = await apiKeyService.ListAsync(tenantId, ct);
        return Results.Ok(keys);
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateApiKeyRequest request,
        IApiKeyService apiKeyService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await apiKeyService.CreateAsync(tenantId, request, ct);

        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.Created($"/api/api-keys/{result.Value.Id}", result.Value);
    }

    private static async Task<IResult> HandleDelete(
        Guid keyId,
        HttpContext ctx,
        IApiKeyService apiKeyService,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await apiKeyService.DeleteAsync(tenantId, keyId, ct);

        return result.IsError
            ? result.Errors.ToHttpResult(ctx)
            : Results.NoContent();
    }
}
