using Clarive.AI.Configuration;
using Microsoft.Extensions.AI;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Deterministic mock for ITavilyClientService. Reports as configured
/// but returns no tools (web search is a no-op in tests).
/// </summary>
internal class MockTavilyClientService : ITavilyClientService
{
    public bool IsConfigured => true;

    public Task<IList<AITool>?> GetToolsAsync(CancellationToken ct = default) =>
        Task.FromResult<IList<AITool>?>(new List<AITool>());

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
