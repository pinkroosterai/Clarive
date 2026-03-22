using Clarive.Application.McpServers.Contracts;
using Clarive.Domain.Interfaces.Repositories;
using Quartz;

namespace Clarive.Application.Background;

[DisallowConcurrentExecution]
public class McpSyncJob(
    IMcpServerRepository serverRepo,
    IMcpServerService serverService,
    ILogger<McpSyncJob> logger
) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var ct = context.CancellationToken;

        var dueServers = await serverRepo.GetDueForSyncAsync(ct);

        if (dueServers.Count == 0)
            return;

        logger.LogInformation("MCP sync: {Count} server(s) due for sync", dueServers.Count);

        foreach (var server in dueServers)
        {
            try
            {
                await serverService.SyncAsync(server.TenantId, server.Id, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(
                    ex,
                    "MCP sync failed for server {ServerName} ({ServerId})",
                    server.Name,
                    server.Id
                );
            }
        }
    }
}
