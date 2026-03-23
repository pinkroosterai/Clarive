using Clarive.Application.ApiKeys;
using Clarive.Application.ApiKeys.Contracts;
using Clarive.Api.Helpers;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.Interfaces.Repositories;

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
        IEmailService emailService,
        IUserRepository userRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();
        var result = await apiKeyService.CreateAsync(tenantId, request, ct);

        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        // Notify the user who created the key
        var user = await userRepo.GetByIdAsync(tenantId, ctx.GetUserId(), ct);
        if (user is not null)
            _ = emailService.SendApiKeyCreatedAsync(user.Email, user.Name, result.Value.Name, result.Value.Prefix, CancellationToken.None);

        return Results.Created($"/api/api-keys/{result.Value.Id}", result.Value);
    }

    private static async Task<IResult> HandleDelete(
        Guid keyId,
        HttpContext ctx,
        IApiKeyService apiKeyService,
        IEmailService emailService,
        IUserRepository userRepo,
        IApiKeyRepository keyRepo,
        CancellationToken ct
    )
    {
        var tenantId = ctx.GetTenantId();

        // Get key name before deletion for the email
        var key = await keyRepo.GetByIdAsync(tenantId, keyId, ct);
        var keyName = key?.Name ?? "Unknown";

        var result = await apiKeyService.DeleteAsync(tenantId, keyId, ct);
        if (result.IsError)
            return result.Errors.ToHttpResult(ctx);

        var user = await userRepo.GetByIdAsync(tenantId, ctx.GetUserId(), ct);
        if (user is not null)
            _ = emailService.SendApiKeyRevokedAsync(user.Email, user.Name, keyName, CancellationToken.None);

        return Results.NoContent();
    }
}
