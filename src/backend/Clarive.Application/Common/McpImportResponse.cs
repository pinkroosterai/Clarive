using Clarive.Domain.Entities;

namespace Clarive.Application.Common;

public record McpImportResponse(List<ToolDescription> Imported, int SkippedCount);
