using System.Text.Json.Nodes;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.IntegrationTests.Helpers;

/// <summary>
/// Deterministic mock for IMcpImportService. Returns predictable tools
/// without connecting to any MCP server. Persists tools via IToolRepository.
/// </summary>
internal class MockMcpImportService : IMcpImportService
{
    private readonly IToolRepository _toolRepo;

    public MockMcpImportService(IToolRepository toolRepo)
    {
        _toolRepo = toolRepo;
    }

    public async Task<McpImportResult> ImportToolsAsync(
        string serverUrl, string? bearerToken, Guid tenantId, CancellationToken ct = default)
    {
        var tools = new List<ToolDescription>
        {
            new()
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "List Resources",
                ToolName = "list_resources",
                Description = $"Lists resources from {serverUrl}.",
                InputSchema = JsonNode.Parse("""{"type":"object","properties":{"filter":{"type":"string"}},"required":["filter"]}"""),
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Execute Action",
                ToolName = "execute_action",
                Description = $"Executes an action on {serverUrl}.",
                CreatedAt = DateTime.UtcNow
            }
        };

        await _toolRepo.CreateManyAsync(tools, ct);

        return new McpImportResult(tools, 0);
    }
}
