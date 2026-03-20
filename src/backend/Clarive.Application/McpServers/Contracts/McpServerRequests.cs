namespace Clarive.Application.McpServers.Contracts;

public record CreateMcpServerRequest(string Name, string Url, string? BearerToken = null);

public record UpdateMcpServerRequest(string? Name, string? Url, string? BearerToken, bool? IsActive);
