using Microsoft.Extensions.AI;

namespace Clarive.AI.Services;

public interface ITavilyClientService : IAsyncDisposable
{
    Task<IList<AITool>?> GetToolsAsync(CancellationToken ct = default);
    bool IsConfigured { get; }
}
