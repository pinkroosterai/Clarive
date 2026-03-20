using System.Text.Json.Nodes;
using Clarive.Domain.Entities;
using Clarive.Domain.Interfaces.Repositories;
using Humanizer;
using ModelContextProtocol.Client;

namespace Clarive.Application.ImportExport.Services;

public class McpImportService(
    IToolRepository toolRepo,
    IHttpClientFactory httpClientFactory,
    ILogger<McpImportService> logger
) : IMcpImportService
{
    private const int MaxTools = 100;
    private const int TimeoutSeconds = 15;
    private const int MaxInputSchemaBytes = 65_536; // 64 KB

    public async Task<McpImportResult> ImportToolsAsync(
        string serverUrl,
        string? bearerToken,
        Guid tenantId,
        CancellationToken ct
    )
    {
        // 1. Build transport with optional bearer token
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

        // 2. Connect and perform MCP handshake (initialize → initialized → ready)
        await using var transport = new HttpClientTransport(transportOptions, httpClient);
        await using var client = await McpClient.CreateAsync(transport, cancellationToken: ct);

        // 3. List tools (SDK handles cursor pagination internally)
        var mcpTools = await client.ListToolsAsync(cancellationToken: ct);

        logger.LogInformation(
            "MCP server {ServerUrl} returned {ToolCount} tools",
            serverUrl,
            mcpTools.Count
        );

        // 4. Cap at MaxTools
        var toolsToProcess = mcpTools.Take(MaxTools).ToList();

        // 5. Query existing tool names for this tenant to skip duplicates
        var existingTools = await toolRepo.GetByTenantAsync(tenantId, ct);
        var existingNames = existingTools.Select(t => t.ToolName).ToHashSet(StringComparer.Ordinal);

        // 6. Map MCP tools → ToolDescription entities, filter duplicates
        var newTools = new List<ToolDescription>();
        var skippedCount = 0;

        foreach (var mcp in toolsToProcess)
        {
            if (existingNames.Contains(mcp.Name))
            {
                skippedCount++;
                continue;
            }

            newTools.Add(
                new ToolDescription
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = (mcp.Title ?? mcp.Name.Humanize(LetterCasing.Sentence)).Truncate(100),
                    ToolName = mcp.Name.Truncate(100),
                    Description = (mcp.Description ?? "").Truncate(500),
                    InputSchema = ParseAndValidateSchema(mcp.JsonSchema),
                    CreatedAt = DateTime.UtcNow,
                }
            );
        }

        // 7. Persist
        if (newTools.Count > 0)
            await toolRepo.CreateManyAsync(newTools, ct);

        return new McpImportResult(newTools, skippedCount);
    }

    private static JsonNode? ParseAndValidateSchema(System.Text.Json.JsonElement jsonSchema)
    {
        if (jsonSchema.ValueKind == System.Text.Json.JsonValueKind.Undefined)
            return null;

        var raw = jsonSchema.GetRawText();
        if (raw.Length > MaxInputSchemaBytes)
            return null; // Skip oversized schemas silently

        return JsonNode.Parse(raw);
    }
}
