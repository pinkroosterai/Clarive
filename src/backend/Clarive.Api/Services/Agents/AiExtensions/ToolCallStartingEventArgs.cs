using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Agents.AiExtensions;

/// <summary>
/// Provides data for the <see cref="EventEmittingFunctionInvokingChatClient.ToolCallStarting"/> event,
/// raised immediately before a function is invoked.
/// </summary>
public sealed class ToolCallStartingEventArgs : EventArgs
{
    /// <summary>Gets the name of the function about to be invoked.</summary>
    public required string FunctionName { get; init; }

    /// <summary>Gets the unique identifier for this particular tool call.</summary>
    public required string CallId { get; init; }

    /// <summary>
    /// Gets the arguments that will be passed to the function.
    /// </summary>
    public AIFunctionArguments? Arguments { get; init; }

    /// <summary>Gets the 0-based iteration number of the current roundtrip with the inner client.</summary>
    public int Iteration { get; init; }

    /// <summary>Gets the 0-based index of this function call within the current iteration.</summary>
    public int FunctionCallIndex { get; init; }

    /// <summary>Gets the total number of function calls requested in the current iteration.</summary>
    public int FunctionCount { get; init; }

    /// <summary>Gets whether this invocation is happening inside a streaming response.</summary>
    public bool IsStreaming { get; init; }

    /// <summary>
    /// Gets the full <see cref="FunctionInvocationContext"/> for advanced scenarios.
    /// </summary>
    public required FunctionInvocationContext Context { get; init; }
}
