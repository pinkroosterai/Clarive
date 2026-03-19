using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;
using ErrorOr;

namespace Clarive.Api.Services.Interfaces;

public interface IShareLinkService
{
    Task<ErrorOr<ShareLinkResult>> CreateAsync(
        Guid tenantId,
        Guid entryId,
        Guid userId,
        DateTime? expiresAt = null,
        string? password = null,
        int? pinnedVersion = null,
        CancellationToken ct = default
    );

    Task<ErrorOr<ShareLink>> GetByEntryIdAsync(
        Guid tenantId,
        Guid entryId,
        CancellationToken ct = default
    );

    Task<ErrorOr<Success>> RevokeAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<SharedEntryResult>> GetPublicEntryByTokenAsync(
        string rawToken,
        CancellationToken ct = default
    );

    Task<ErrorOr<SharedEntryResult>> VerifyPasswordAndGetEntryAsync(
        string rawToken,
        string password,
        CancellationToken ct = default
    );
}
