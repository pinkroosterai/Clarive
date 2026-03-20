using Clarive.Domain.Entities;

namespace Clarive.Application.ImportExport.Contracts;

public record McpImportResponse(List<ToolDescription> Imported, int SkippedCount);
