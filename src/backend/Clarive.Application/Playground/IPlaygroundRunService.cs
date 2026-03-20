using Clarive.Domain.Entities;

namespace Clarive.Application.Playground;

public interface IPlaygroundRunService
{
    Task<PlaygroundRun> SaveRunAsync(PlaygroundRun run, CancellationToken ct = default);

    Task<PlaygroundRun?> GetByIdAsync(Guid runId, CancellationToken ct = default);

    Task UpdateRunAsync(PlaygroundRun run, CancellationToken ct = default);

    Task<List<TestRunResponse>> GetRunsAsync(Guid entryId, CancellationToken ct = default);
}
