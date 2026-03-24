using ErrorOr;

namespace Clarive.Application.Tabs.Contracts;

public interface ITabService
{
    Task<ErrorOr<TabInfo>> CreateAsync(
        Guid tenantId, Guid entryId, CreateTabRequest request, CancellationToken ct = default);

    Task<ErrorOr<List<TabInfo>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<TabInfo>> RenameAsync(
        Guid tenantId, Guid entryId, Guid tabId, RenameTabRequest request, CancellationToken ct = default);

    Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid tabId, CancellationToken ct = default);
}
