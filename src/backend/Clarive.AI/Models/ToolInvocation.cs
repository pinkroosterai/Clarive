namespace Clarive.AI.Models;

public record ToolInvocation(
    string ToolName,
    string CallId,
    string? Arguments,
    string? Response,
    long DurationMs,
    string? Error = null
);
