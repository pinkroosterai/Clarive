using Clarive.Domain.Entities;
using Clarive.Core.Models.Responses;

namespace Clarive.Core.Services.Interfaces;

public interface IPlaygroundRunService
{
    Task<PlaygroundRun> SaveRunAsync(PlaygroundRun run, CancellationToken ct = default);

    Task<PlaygroundRun?> GetByIdAsync(Guid runId, CancellationToken ct = default);

    Task UpdateRunAsync(PlaygroundRun run, CancellationToken ct = default);

    Task<List<TestRunResponse>> GetRunsAsync(Guid entryId, CancellationToken ct = default);
}
