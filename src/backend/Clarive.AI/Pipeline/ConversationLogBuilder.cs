using System.Text.Json;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Pipeline;

/// <summary>
/// Accumulates conversation messages in chronological order during a playground run.
/// Thread-safe for concurrent tool call events via lock.
/// </summary>
public sealed class ConversationLogBuilder
{
    private readonly List<ConversationMessage> _messages = [];
    private readonly object _lock = new();

    public IReadOnlyList<ConversationMessage> Messages
    {
        get { lock (_lock) return _messages.ToList(); }
    }

    public void AddSystemMessage(string content)
    {
        lock (_lock)
            _messages.Add(new ConversationMessage("system", content));
    }

    public void AddUserMessage(string content, int promptIndex)
    {
        lock (_lock)
            _messages.Add(new ConversationMessage("user", content, PromptIndex: promptIndex));
    }

    public void AddToolCall(string toolName, string callId, string? arguments)
    {
        lock (_lock)
            _messages.Add(new ConversationMessage(
                "tool_call",
                $"Calling {toolName}",
                ToolName: toolName,
                CallId: callId,
                Arguments: arguments
            ));
    }

    public void AddToolResult(string callId, string? result, string? error, long durationMs)
    {
        lock (_lock)
            _messages.Add(new ConversationMessage(
                "tool_result",
                result ?? "",
                CallId: callId,
                Error: error,
                DurationMs: durationMs
            ));
    }

    public void AddAssistantMessage(string content, string? reasoning, int promptIndex)
    {
        lock (_lock)
            _messages.Add(new ConversationMessage(
                "assistant",
                content,
                Reasoning: reasoning,
                PromptIndex: promptIndex
            ));
    }

    /// <summary>
    /// Subscribes to EventEmittingFunctionInvokingChatClient events to capture tool calls.
    /// </summary>
    public Task OnToolCallStartingAsync(object sender, ToolCallStartingEventArgs e)
    {
        var argsJson = e.Arguments is { Count: > 0 }
            ? JsonSerializer.Serialize(e.Arguments)
            : null;
        AddToolCall(e.FunctionName, e.CallId, argsJson);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Subscribes to EventEmittingFunctionInvokingChatClient events to capture tool results.
    /// </summary>
    public Task OnToolCallCompletedAsync(object sender, ToolCallCompletedEventArgs e)
    {
        var response = e.Result?.ToString();
        var durationMs = (long)e.Duration.TotalMilliseconds;
        var error = e.Exception?.Message;
        AddToolResult(e.CallId, response, error, durationMs);
        return Task.CompletedTask;
    }
}
