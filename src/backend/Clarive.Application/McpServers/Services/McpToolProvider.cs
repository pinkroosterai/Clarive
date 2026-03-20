using Clarive.Application.McpServers.Contracts;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Security;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Client;

namespace Clarive.Application.McpServers.Services;

public class McpToolProvider(
    IMcpServerRepository serverRepo,
    IEncryptionService encryptionService,
    IHttpClientFactory httpClientFactory,
    ILogger<McpToolProvider> logger
) : IMcpToolProvider
{
    private const int TimeoutSeconds = 15;

    public async Task<IList<AITool>> GetToolsAsync(
        Guid tenantId,
        List<Guid> serverIds,
        List<string>? excludedToolNames = null,
        CancellationToken ct = default
    )
    {
        if (serverIds.Count == 0)
            return [];

        var excluded = excludedToolNames is { Count: > 0 }
            ? new HashSet<string>(excludedToolNames, StringComparer.OrdinalIgnoreCase)
            : null;

        var allTools = new List<AITool>();

        foreach (var serverId in serverIds)
        {
            try
            {
                var server = await serverRepo.GetByIdAsync(tenantId, serverId, ct);
                if (server is null || !server.IsActive)
                    continue;

                var bearerToken = server.BearerTokenEncrypted is not null
                    ? encryptionService.Decrypt(server.BearerTokenEncrypted)
                    : null;

                var tools = await FetchToolsFromServer(server.Url, bearerToken, ct);

                foreach (var tool in tools)
                {
                    if (excluded is not null && excluded.Contains(tool.Name))
                        continue;
                    allTools.Add(tool);
                }

                logger.LogInformation(
                    "Fetched {Count} tools from MCP server {ServerName} for playground",
                    tools.Count,
                    server.Name
                );
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(
                    ex,
                    "Failed to fetch tools from MCP server {ServerId} for playground",
                    serverId
                );
            }
        }

        return allTools;
    }

    private async Task<IList<AITool>> FetchToolsFromServer(
        string serverUrl,
        string? bearerToken,
        CancellationToken ct
    )
    {
        var transportOptions = new HttpClientTransportOptions { Endpoint = new Uri(serverUrl) };

        if (bearerToken is not null)
        {
            transportOptions.AdditionalHeaders = new Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {bearerToken}",
            };
        }

        var httpClient = httpClientFactory.CreateClient("Mcp");
        httpClient.Timeout = TimeSpan.FromSeconds(TimeoutSeconds);

        await using var transport = new HttpClientTransport(transportOptions, httpClient);
        await using var client = await McpClient.CreateAsync(transport, cancellationToken: ct);

        var tools = await client.ListToolsAsync(cancellationToken: ct);
        return tools.Cast<AITool>().ToList();
    }
}
