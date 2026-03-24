using ErrorOr;

namespace Clarive.Application.AbTests.Contracts;

public interface IAbTestService
{
    Task<ErrorOr<AbTestRunDetailResponse>> RunAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        StartAbTestRequest request,
        Func<AbTestProgressEvent, Task>? onProgress = null,
        CancellationToken ct = default);

    Task<ErrorOr<AbTestRunDetailResponse>> GetAsync(
        Guid tenantId, Guid entryId, Guid runId, CancellationToken ct = default);

    Task<ErrorOr<List<AbTestRunResponse>>> ListAsync(
        Guid tenantId, Guid entryId, CancellationToken ct = default);

    Task<ErrorOr<bool>> DeleteAsync(
        Guid tenantId, Guid entryId, Guid runId, CancellationToken ct = default);
}
