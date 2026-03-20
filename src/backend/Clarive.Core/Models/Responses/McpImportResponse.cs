using Clarive.Domain.Entities;

namespace Clarive.Core.Models.Responses;

public record McpImportResponse(List<ToolDescription> Imported, int SkippedCount);
