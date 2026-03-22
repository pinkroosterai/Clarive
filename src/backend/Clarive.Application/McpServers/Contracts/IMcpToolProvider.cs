using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.McpServers.Contracts;

/// <summary>
/// Result of fetching MCP tools. Must be disposed after the tools are no longer needed
/// (after the playground run completes) to close the MCP server connections.
/// McpClientTool objects hold references to the MCP client and require the connection
/// to stay alive for tool invocation.
/// </summary>
public sealed class McpToolSet : IAsyncDisposable
{
    public IList<AITool> Tools { get; set; } = [];
    private readonly List<IAsyncDisposable> _disposables = [];
    private readonly ILogger? _logger;

    public McpToolSet(ILogger? logger = null)
    {
        _logger = logger;
    }

    internal void AddDisposable(IAsyncDisposable disposable)
    {
        _disposables.Add(disposable);
    }

    public async ValueTask DisposeAsync()
    {
        // Dispose in reverse order (clients before transports)
        for (var i = _disposables.Count - 1; i >= 0; i--)
        {
            try { await _disposables[i].DisposeAsync(); }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispose MCP resource at index {Index}", i);
            }
        }
        _disposables.Clear();
    }
}

public interface IMcpToolProvider
{
    Task<McpToolSet> GetToolsAsync(
        Guid tenantId,
        List<Guid> serverIds,
        List<string>? excludedToolNames = null,
        CancellationToken ct = default
    );
}
