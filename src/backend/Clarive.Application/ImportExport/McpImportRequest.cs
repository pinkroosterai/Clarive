namespace Clarive.Application.ImportExport;

public record McpImportRequest(string ServerUrl, string? BearerToken = null);
