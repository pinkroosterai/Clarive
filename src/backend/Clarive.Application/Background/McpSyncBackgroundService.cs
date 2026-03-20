using Clarive.Application.McpServers.Contracts;
using Clarive.Domain.Interfaces.Repositories;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Clarive.Application.Background;

public class McpSyncBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<McpSyncBackgroundService> logger
) : BackgroundService
{
    private static readonly TimeSpan ColdStartDelay = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(ColdStartDelay, ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await SyncDueServersAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Unexpected error in MCP sync loop");
            }

            await Task.Delay(PollInterval, ct);
        }
    }

    private async Task SyncDueServersAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var serverRepo = scope.ServiceProvider.GetRequiredService<IMcpServerRepository>();
        var serverService = scope.ServiceProvider.GetRequiredService<IMcpServerService>();

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
