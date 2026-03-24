using Clarive.Domain.Entities;
using Clarive.Domain.Enums;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IAbTestRepository
{
    Task<ABTestRun?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct = default);
    Task<List<ABTestRun>> GetByEntryIdAsync(Guid tenantId, Guid entryId, CancellationToken ct = default);
    Task<ABTestRun> CreateAsync(ABTestRun run, CancellationToken ct = default);
    Task UpdateStatusAsync(Guid id, ABTestStatus status, DateTime? completedAt = null, CancellationToken ct = default);
    Task<ABTestResult> AddResultAsync(ABTestResult result, CancellationToken ct = default);
    Task<List<ABTestResult>> AddResultsAsync(List<ABTestResult> results, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, CancellationToken ct = default);
}
