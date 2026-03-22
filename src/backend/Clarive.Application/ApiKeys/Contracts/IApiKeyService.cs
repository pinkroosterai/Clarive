using ErrorOr;

namespace Clarive.Application.ApiKeys.Contracts;

public interface IApiKeyService
{
    Task<List<ApiKeyResponse>> ListAsync(Guid tenantId, CancellationToken ct = default);
    Task<ErrorOr<ApiKeyCreated>> CreateAsync(Guid tenantId, CreateApiKeyRequest request, CancellationToken ct = default);
    Task<ErrorOr<Deleted>> DeleteAsync(Guid tenantId, Guid keyId, CancellationToken ct = default);
}

public record ApiKeyResponse(
    Guid Id,
    string Name,
    string Key,
    DateTime CreatedAt,
    DateTime? ExpiresAt,
    DateTime? LastUsedAt,
    long UsageCount,
    bool IsExpired
);
