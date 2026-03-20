namespace Clarive.AI.Models;

public record ConversationMessage(
    string Role,
    string Content,
    string? ToolName = null,
    string? CallId = null,
    string? Arguments = null,
    string? Error = null,
    long? DurationMs = null,
    string? Reasoning = null,
    int? PromptIndex = null
);
