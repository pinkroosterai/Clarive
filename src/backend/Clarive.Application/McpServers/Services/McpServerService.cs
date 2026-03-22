using Clarive.Domain.Interfaces.Services;
using System.Text.Json.Nodes;
using Clarive.Application.Common;
using Clarive.Application.McpServers.Contracts;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Infrastructure.Security;
using ErrorOr;
using Humanizer;
using Microsoft.Extensions.Logging;
using ModelContextProtocol.Client;

namespace Clarive.Application.McpServers.Services;

public class McpServerService(
    IMcpServerRepository serverRepo,
    IToolRepository toolRepo,
    IEncryptionService encryptionService,
    IHttpClientFactory httpClientFactory,
    IUnitOfWork unitOfWork,
    ILogger<McpServerService> logger
) : IMcpServerService
{
    private const int MaxTools = 200;
    private const int TimeoutSeconds = 30;
    private const int MaxInputSchemaBytes = 65_536;
    private static readonly Random Jitter = new();

    public async Task<List<McpServerResponse>> ListAsync(Guid tenantId, CancellationToken ct = default)
    {
        var servers = await serverRepo.GetByTenantAsync(tenantId, ct);
        return servers.Select(ToResponse).ToList();
    }

    public async Task<ErrorOr<McpServerResponse>> GetByIdAsync(Guid tenantId, Guid serverId, CancellationToken ct = default)
    {
        var server = await serverRepo.GetByIdAsync(tenantId, serverId, ct);
        if (server is null)
            return Error.NotFound("MCP_SERVER_NOT_FOUND", "MCP server not found.");
        return ToResponse(server);
    }

    public async Task<ErrorOr<McpServerResponse>> CreateAsync(
        Guid tenantId,
        CreateMcpServerRequest request,
        CancellationToken ct = default
    )
    {
        var now = DateTime.UtcNow;
        var server = new McpServer
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Url = request.Url.Trim(),
            BearerTokenEncrypted = EncryptToken(request.BearerToken),
            IsActive = true,
            NextSyncAt = now, // Sync immediately on first background pass
            CreatedAt = now,
            UpdatedAt = now,
        };

        await serverRepo.CreateAsync(server, ct);
        return ToResponse(server);
    }

    public async Task<ErrorOr<McpServerResponse>> UpdateAsync(
        Guid tenantId,
        Guid serverId,
        UpdateMcpServerRequest request,
        CancellationToken ct = default
    )
    {
        var server = await serverRepo.GetByIdAsync(tenantId, serverId, ct);
        if (server is null)
            return Error.NotFound("MCP_SERVER_NOT_FOUND", "MCP server not found.");

        if (request.Name is not null)
            server.Name = request.Name.Trim();
        if (request.Url is not null)
            server.Url = request.Url.Trim();
        if (request.BearerToken is not null)
            server.BearerTokenEncrypted = request.BearerToken == "" ? null : EncryptToken(request.BearerToken);
        if (request.IsActive is not null)
            server.IsActive = request.IsActive.Value;

        server.UpdatedAt = DateTime.UtcNow;
        await serverRepo.UpdateAsync(server, ct);
        return ToResponse(server);
    }

    public async Task<ErrorOr<Deleted>> DeleteAsync(Guid tenantId, Guid serverId, CancellationToken ct = default)
    {
        var server = await serverRepo.GetByIdAsync(tenantId, serverId, ct);
        if (server is null)
            return Error.NotFound("MCP_SERVER_NOT_FOUND", "MCP server not found.");

        // Delete all tools synced from this server first
        await toolRepo.DeleteByServerIdAsync(tenantId, serverId, ct);
        await serverRepo.DeleteAsync(tenantId, serverId, ct);
        return Result.Deleted;
    }

    public async Task<ErrorOr<McpServerResponse>> SyncAsync(
        Guid tenantId,
        Guid serverId,
        CancellationToken ct = default
    )
    {
        var server = await serverRepo.GetByIdAsync(tenantId, serverId, ct);
        if (server is null)
            return Error.NotFound("MCP_SERVER_NOT_FOUND", "MCP server not found.");

        try
        {
            var bearerToken = server.BearerTokenEncrypted is not null
                ? encryptionService.Decrypt(server.BearerTokenEncrypted)
                : null;

            var newTools = await FetchAndMapToolsAsync(server.Url, bearerToken, tenantId, serverId, ct);

            // Clean-replace in a transaction so delete+create+update are atomic
            await unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                await toolRepo.DeleteByServerIdAsync(tenantId, serverId, ct);

                if (newTools.Count > 0)
                    await toolRepo.CreateManyAsync(newTools, ct);

                server.ToolCount = newTools.Count;
                server.LastSyncedAt = DateTime.UtcNow;
                server.NextSyncAt = CalculateNextSync();
                server.LastSyncError = null;
                server.UpdatedAt = DateTime.UtcNow;
                await serverRepo.UpdateAsync(server, ct);
            }, ct);

            logger.LogInformation(
                "Synced MCP server {ServerName} ({ServerUrl}): {ToolCount} tools",
                server.Name,
                server.Url,
                newTools.Count
            );

            return ToResponse(server);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(
                ex,
                "Failed to sync MCP server {ServerName} ({ServerUrl})",
                server.Name,
                server.Url
            );

            server.LastSyncError = ex.Message.Truncate(500);
            server.NextSyncAt = CalculateNextSync();
            server.UpdatedAt = DateTime.UtcNow;
            await serverRepo.UpdateAsync(server, ct);

            return Error.Failure("MCP_SYNC_FAILED", $"Sync failed: {ex.Message.Truncate(200)}");
        }
    }

    private async Task<List<ToolDescription>> FetchAndMapToolsAsync(
        string serverUrl,
        string? bearerToken,
        Guid tenantId,
        Guid serverId,
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

        var mcpTools = await client.ListToolsAsync(cancellationToken: ct);

        return mcpTools.Take(MaxTools).Select(mcp => new ToolDescription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = (mcp.Title ?? mcp.Name.Humanize(LetterCasing.Sentence)).Truncate(100),
            ToolName = mcp.Name.Truncate(100),
            Description = (mcp.Description ?? "").Truncate(4000),
            InputSchema = ParseAndValidateSchema(mcp.JsonSchema),
            McpServerId = serverId,
            CreatedAt = DateTime.UtcNow,
        }).ToList();
    }

    private static DateTime CalculateNextSync()
    {
        // 24h ± 2h jitter
        var jitterMinutes = Jitter.Next(-120, 121);
        return DateTime.UtcNow.AddHours(24).AddMinutes(jitterMinutes);
    }

    private string? EncryptToken(string? plainToken)
    {
        if (string.IsNullOrWhiteSpace(plainToken))
            return null;
        return encryptionService.IsAvailable ? encryptionService.Encrypt(plainToken) : plainToken;
    }

    private static JsonNode? ParseAndValidateSchema(System.Text.Json.JsonElement jsonSchema)
    {
        if (jsonSchema.ValueKind == System.Text.Json.JsonValueKind.Undefined)
            return null;

        var raw = jsonSchema.GetRawText();
        if (raw.Length > MaxInputSchemaBytes)
            return null;

        return JsonNode.Parse(raw);
    }

    private static McpServerResponse ToResponse(McpServer s) =>
        new(
            s.Id,
            s.Name,
            s.Url,
            s.BearerTokenEncrypted is not null,
            s.IsActive,
            s.LastSyncedAt,
            s.NextSyncAt,
            s.LastSyncError,
            s.ToolCount,
            s.CreatedAt,
            s.UpdatedAt
        );
}
