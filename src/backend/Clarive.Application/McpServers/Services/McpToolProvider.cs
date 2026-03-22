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
    private const int TimeoutSeconds = 30;

    public async Task<McpToolSet> GetToolsAsync(
        Guid tenantId,
        List<Guid> serverIds,
        List<string>? excludedToolNames = null,
        CancellationToken ct = default
    )
    {
        var toolSet = new McpToolSet(logger);

        if (serverIds.Count == 0)
            return toolSet;

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

                var tools = await ConnectAndListTools(server.Url, bearerToken, toolSet, ct);

                foreach (var tool in tools)
                {
                    if (excluded is not null && excluded.Contains(tool.Name))
                        continue;
                    // Pass McpClientTool directly — no wrapping.
                    // McpClientTool.InvokeAsync needs the original object intact.
                    allTools.Add(tool);
                }

                logger.LogInformation(
                    "Connected to MCP server {ServerName} for playground, {Count} tools available",
                    server.Name,
                    tools.Count
                );
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(
                    ex,
                    "Failed to connect to MCP server {ServerId} for playground",
                    serverId
                );
            }
        }

        toolSet.Tools = allTools;
        return toolSet;
    }

    /// <summary>
    /// Connects to an MCP server and lists its tools.
    /// The transport and client are added to the McpToolSet for lifecycle management —
    /// they stay alive until the McpToolSet is disposed (after the playground run).
    /// This is critical because McpClientTool objects hold references to the McpClient
    /// and need it alive to invoke tools.
    /// </summary>
    private async Task<IList<AITool>> ConnectAndListTools(
        string serverUrl,
        string? bearerToken,
        McpToolSet toolSet,
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

        // Create transport and client — DO NOT use 'await using' here.
        // These must stay alive for the duration of the playground run
        // so that McpClientTool can invoke tools via the connection.
        var transport = new HttpClientTransport(transportOptions, httpClient);
        McpClient client;
        try
        {
            client = await McpClient.CreateAsync(transport, cancellationToken: ct);
        }
        catch
        {
            await transport.DisposeAsync();
            throw;
        }

        // Register for cleanup when the tool set is disposed
        toolSet.AddDisposable(client);
        toolSet.AddDisposable(transport);

        var tools = await client.ListToolsAsync(cancellationToken: ct);
        return tools.Cast<AITool>().ToList();
    }
}
