using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Agents.AiExtensions;

/// <summary>
/// Provides data for the <see cref="EventEmittingFunctionInvokingChatClient.ToolCallCompleted"/> event,
/// raised after a function invocation finishes (successfully or with an error).
/// </summary>
public sealed class ToolCallCompletedEventArgs : EventArgs
{
    /// <summary>Gets the name of the function that was invoked.</summary>
    public required string FunctionName { get; init; }

    /// <summary>Gets the unique identifier for this particular tool call.</summary>
    public required string CallId { get; init; }

    /// <summary>Gets the result returned by the function, or <see langword="null"/> on failure.</summary>
    public object? Result { get; init; }

    /// <summary>Gets the exception thrown by the function, or <see langword="null"/> on success.</summary>
    public Exception? Exception { get; init; }

    /// <summary>Gets the wall-clock duration of the function invocation (excluding event handler time).</summary>
    public TimeSpan Duration { get; init; }

    /// <summary>Gets the 0-based iteration number of the current roundtrip with the inner client.</summary>
    public int Iteration { get; init; }

    /// <summary>Gets whether this invocation happened inside a streaming response.</summary>
    public bool IsStreaming { get; init; }

    /// <summary>Gets whether the function requested early termination of the tool-calling loop.</summary>
    public bool TerminationRequested { get; init; }

    /// <summary>Gets whether the function completed without throwing.</summary>
    public bool Succeeded => Exception is null;

    /// <summary>
    /// Gets the full <see cref="FunctionInvocationContext"/> for advanced scenarios.
    /// </summary>
    public required FunctionInvocationContext Context { get; init; }
}
