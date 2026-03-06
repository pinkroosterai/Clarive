namespace Clarive.Api.Models.Requests;

public record McpImportRequest(string ServerUrl, string? BearerToken = null);
