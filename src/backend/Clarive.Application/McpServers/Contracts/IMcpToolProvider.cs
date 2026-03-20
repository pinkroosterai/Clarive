using Microsoft.Extensions.AI;

namespace Clarive.Application.McpServers.Contracts;

public interface IMcpToolProvider
{
    Task<IList<AITool>> GetToolsAsync(
        Guid tenantId,
        List<Guid> serverIds,
        List<string>? excludedToolNames = null,
        CancellationToken ct = default
    );
}
