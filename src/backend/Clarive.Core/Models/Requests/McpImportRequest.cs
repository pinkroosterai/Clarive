namespace Clarive.Core.Models.Requests;

public record McpImportRequest(string ServerUrl, string? BearerToken = null);
