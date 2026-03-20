using System.Text.Json.Nodes;

namespace Clarive.Application.Tools;

public record UpdateToolRequest(string? Name, string? ToolName, string? Description, JsonNode? InputSchema = null);
