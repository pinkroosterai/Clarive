using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IShareLinkRepository
{
    Task<ShareLink?> GetByTokenHashAsync(string tokenHash, CancellationToken ct = default);
    Task<ShareLink?> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<ShareLink> CreateAsync(ShareLink shareLink, CancellationToken ct = default);
    Task<bool> DeleteByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task IncrementAccessCountAsync(Guid shareLinkId, CancellationToken ct = default);
}
