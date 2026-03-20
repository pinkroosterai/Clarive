namespace Clarive.Application.ImportExport.Contracts;

public record McpImportRequest(string ServerUrl, string? BearerToken = null);
