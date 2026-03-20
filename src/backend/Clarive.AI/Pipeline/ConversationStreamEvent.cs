namespace Clarive.AI.Pipeline;

/// <summary>
/// A single event in the unified conversation stream.
/// Captures text, reasoning, tool calls, and tool results in chronological order.
/// </summary>
public record ConversationStreamEvent
{
    public required string Type { get; init; }
    public string? Text { get; init; }
    public string? ToolName { get; init; }
    public string? CallId { get; init; }
    public string? Arguments { get; init; }
    public string? Result { get; init; }
    public string? Error { get; init; }
    public long? DurationMs { get; init; }
    public int PromptIndex { get; init; }

    public static ConversationStreamEvent TextChunk(int promptIndex, string text) =>
        new() { Type = "text", Text = text, PromptIndex = promptIndex };

    public static ConversationStreamEvent ReasoningChunk(int promptIndex, string text) =>
        new() { Type = "reasoning", Text = text, PromptIndex = promptIndex };

    public static ConversationStreamEvent ToolCallStart(
        string toolName, string callId, string? arguments, int promptIndex = 0) =>
        new() { Type = "tool_start", ToolName = toolName, CallId = callId, Arguments = arguments, PromptIndex = promptIndex };

    public static ConversationStreamEvent ToolCallEnd(
        string callId, string? result, string? error, long durationMs, int promptIndex = 0) =>
        new() { Type = "tool_end", CallId = callId, Result = result, Error = error, DurationMs = durationMs, PromptIndex = promptIndex };

    public static ConversationStreamEvent Judging() =>
        new() { Type = "judging" };
}
