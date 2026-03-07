using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Interfaces;

public interface ITavilyClientService : IAsyncDisposable
{
    Task<IList<AITool>?> GetToolsAsync(CancellationToken ct = default);
    bool IsConfigured { get; }
}
