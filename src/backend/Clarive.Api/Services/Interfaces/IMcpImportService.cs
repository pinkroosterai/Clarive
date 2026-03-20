using Clarive.Domain.Entities;

namespace Clarive.Api.Services.Interfaces;

public record McpImportResult(List<ToolDescription> Imported, int SkippedCount);

public interface IMcpImportService
{
    Task<McpImportResult> ImportToolsAsync(
        string serverUrl,
        string? bearerToken,
        Guid tenantId,
        CancellationToken ct = default
    );
}
