using System.Security.Cryptography;
using System.Text;
using Clarive.Application.ApiKeys.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;

namespace Clarive.Application.ApiKeys.Services;

public class ApiKeyService(IApiKeyRepository keyRepo) : IApiKeyService
{
    public async Task<List<ApiKeyResponse>> ListAsync(Guid tenantId, CancellationToken ct = default)
    {
        var keys = await keyRepo.GetByTenantAsync(tenantId, ct);
        return keys
            .Select(k => new ApiKeyResponse(
                k.Id,
                k.Name,
                k.KeyPrefix,
                k.CreatedAt,
                k.ExpiresAt,
                k.LastUsedAt,
                k.UsageCount,
                k.ExpiresAt.HasValue && k.ExpiresAt.Value < DateTime.UtcNow
            ))
            .ToList();
    }

    public async Task<ErrorOr<ApiKeyCreated>> CreateAsync(
        Guid tenantId,
        CreateApiKeyRequest request,
        CancellationToken ct = default
    )
    {
        var validationErr = Validator.ValidateAndGetError(request);
        if (validationErr is not null)
            return validationErr.Value;

        if (request.ExpiresAt.HasValue && request.ExpiresAt.Value.ToUniversalTime() <= DateTime.UtcNow)
            return Error.Validation("VALIDATION_ERROR", "Expiry date must be in the future.");

        // Generate the key: cl_ + 32 random hex chars
        var rawKey = $"cl_{Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLower()}";
        var keyHash = HashKey(rawKey);
        var prefix = $"{rawKey[..7]}••••••••••••{rawKey[^4..]}";

        var apiKey = await keyRepo.CreateAsync(
            new ApiKey
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = request.Name.Trim(),
                KeyHash = keyHash,
                KeyPrefix = prefix,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = request.ExpiresAt?.ToUniversalTime(),
            },
            ct
        );

        return new ApiKeyCreated(
            apiKey.Id,
            apiKey.Name,
            rawKey,
            prefix,
            apiKey.CreatedAt,
            apiKey.ExpiresAt,
            apiKey.LastUsedAt,
            apiKey.UsageCount
        );
    }

    public async Task<ErrorOr<Deleted>> DeleteAsync(Guid tenantId, Guid keyId, CancellationToken ct = default)
    {
        var key = await keyRepo.GetByIdAsync(tenantId, keyId, ct);
        if (key is null)
            return Error.NotFound("NOT_FOUND", "API key not found.");

        await keyRepo.DeleteAsync(tenantId, keyId, ct);
        return Result.Deleted;
    }

    public static string HashKey(string rawKey) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawKey))).ToLower();
}
