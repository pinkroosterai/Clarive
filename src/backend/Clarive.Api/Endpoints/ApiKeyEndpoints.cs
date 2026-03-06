using System.Security.Cryptography;
using System.Text;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Auth;
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

    private static async Task<IResult> HandleList(HttpContext ctx, IApiKeyRepository keyRepo, CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var keys = await keyRepo.GetByTenantAsync(tenantId, ct);
        // Return with prefix only — never expose full key or hash
        var response = keys.Select(k => new
        {
            k.Id, k.Name, Key = k.KeyPrefix, k.CreatedAt
        }).ToList();
        return Results.Ok(response);
    }

    private static async Task<IResult> HandleCreate(
        HttpContext ctx,
        CreateApiKeyRequest request,
        IApiKeyRepository keyRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();

        if (string.IsNullOrWhiteSpace(request.Name))
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name is required.");

        if (request.Name.Trim().Length > 100)
            return ctx.ErrorResult(422, "VALIDATION_ERROR", "Name must be 100 characters or fewer.");

        // Generate the key: cl_ + 32 random hex chars
        var rawKey = $"cl_{Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower()}";
        var keyHash = HashKey(rawKey);
        var prefix = $"{rawKey[..7]}••••••••••••{rawKey[^4..]}";

        var apiKey = await keyRepo.CreateAsync(new ApiKey
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            KeyHash = keyHash,
            KeyPrefix = prefix,
            CreatedAt = DateTime.UtcNow
        }, ct);

        // Return full key only on creation — never again
        return Results.Created($"/api/api-keys/{apiKey.Id}",
            new ApiKeyCreated(apiKey.Id, apiKey.Name, rawKey, prefix, apiKey.CreatedAt));
    }

    private static async Task<IResult> HandleDelete(
        Guid keyId,
        HttpContext ctx,
        IApiKeyRepository keyRepo,
        CancellationToken ct)
    {
        var tenantId = ctx.GetTenantId();
        var key = await keyRepo.GetByIdAsync(tenantId, keyId, ct);
        if (key is null)
            return ctx.ErrorResult(404, "NOT_FOUND", "API key not found.", "ApiKey", keyId.ToString());

        await keyRepo.DeleteAsync(tenantId, keyId, ct);
        return Results.NoContent();
    }

    public static string HashKey(string rawKey)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawKey))).ToLower();
}
