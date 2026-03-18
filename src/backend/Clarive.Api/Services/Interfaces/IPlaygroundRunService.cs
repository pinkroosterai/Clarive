using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Responses;

namespace Clarive.Api.Services.Interfaces;

public interface IPlaygroundRunService
{
    Task<PlaygroundRun> SaveRunAsync(PlaygroundRun run, CancellationToken ct = default);

    Task<PlaygroundRun?> GetByIdAsync(Guid runId, CancellationToken ct = default);

    Task UpdateRunAsync(PlaygroundRun run, CancellationToken ct = default);

    Task<List<TestRunResponse>> GetRunsAsync(Guid entryId, CancellationToken ct = default);
}
