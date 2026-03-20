using Clarive.Domain.Entities;

namespace Clarive.Api.Models.Responses;

public record McpImportResponse(List<ToolDescription> Imported, int SkippedCount);
