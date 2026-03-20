using ErrorOr;

namespace Clarive.Application.McpServers.Contracts;

public interface IMcpServerService
{
    Task<List<McpServerResponse>> ListAsync(Guid tenantId, CancellationToken ct = default);
    Task<ErrorOr<McpServerResponse>> GetByIdAsync(Guid tenantId, Guid serverId, CancellationToken ct = default);
    Task<ErrorOr<McpServerResponse>> CreateAsync(Guid tenantId, CreateMcpServerRequest request, CancellationToken ct = default);
    Task<ErrorOr<McpServerResponse>> UpdateAsync(Guid tenantId, Guid serverId, UpdateMcpServerRequest request, CancellationToken ct = default);
    Task<ErrorOr<Deleted>> DeleteAsync(Guid tenantId, Guid serverId, CancellationToken ct = default);
    Task<ErrorOr<McpServerResponse>> SyncAsync(Guid tenantId, Guid serverId, CancellationToken ct = default);
}
