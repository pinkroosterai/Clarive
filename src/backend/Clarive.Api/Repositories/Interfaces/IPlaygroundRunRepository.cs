using Clarive.Api.Models.Entities;

namespace Clarive.Api.Repositories.Interfaces;

public interface IPlaygroundRunRepository
{
    Task<PlaygroundRun?> GetByIdAsync(Guid runId, CancellationToken ct = default);
    Task<List<PlaygroundRun>> GetByEntryIdAsync(Guid entryId, int limit, CancellationToken ct = default);
    Task<PlaygroundRun> AddAsync(PlaygroundRun run, CancellationToken ct = default);
    Task UpdateAsync(PlaygroundRun run, CancellationToken ct = default);
    Task<int> DeleteOlderThanAsync(DateTime cutoff, CancellationToken ct = default);
    Task<int> CountByEntryIdAsync(Guid entryId, CancellationToken ct = default);
    Task DeleteOldestByEntryIdAsync(Guid entryId, int keepCount, CancellationToken ct = default);
}
