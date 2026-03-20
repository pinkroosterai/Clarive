using Clarive.Domain.Entities;

namespace Clarive.Domain.Interfaces.Repositories;

public interface IMcpServerRepository
{
    Task<List<McpServer>> GetByTenantAsync(Guid tenantId, CancellationToken ct = default);
    Task<McpServer?> GetByIdAsync(Guid tenantId, Guid serverId, CancellationToken ct = default);
    Task<List<McpServer>> GetDueForSyncAsync(CancellationToken ct = default);
    Task<McpServer> CreateAsync(McpServer server, CancellationToken ct = default);
    Task<McpServer> UpdateAsync(McpServer server, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid tenantId, Guid serverId, CancellationToken ct = default);
}
