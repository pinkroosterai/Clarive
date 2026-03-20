using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Humanizer;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace Clarive.AI.Pipeline;

/// <summary>
/// A <see cref="FunctionInvokingChatClient"/> that emits a unified stream of conversation events
/// covering text chunks, reasoning chunks, tool call starts, and tool call completions.
/// All events flow through <see cref="OnStreamEvent"/> in chronological order.
/// </summary>
public class EventEmittingFunctionInvokingChatClient : FunctionInvokingChatClient
{
    /// <summary>
    /// Single callback for all conversation stream events (text, reasoning, tool calls).
    /// Set this before calling GetStreamingResponseAsync.
    /// </summary>
    public Func<ConversationStreamEvent, Task>? OnStreamEvent { get; set; }

    /// <summary>
    /// Raised immediately before a function is invoked.
    /// </summary>
    public event Func<object, ToolCallStartingEventArgs, Task>? ToolCallStarting;

    /// <summary>
    /// Raised after a function invocation completes, whether it succeeded or threw.
    /// </summary>
    public event Func<object, ToolCallCompletedEventArgs, Task>? ToolCallCompleted;

    public EventEmittingFunctionInvokingChatClient(
        IChatClient innerClient,
        ILoggerFactory? loggerFactory = null,
        IServiceProvider? functionInvocationServices = null
    )
        : base(innerClient, loggerFactory, functionInvocationServices) { }

    protected virtual void OnCompletedHandlerException(
        Exception handlerException,
        Exception? functionException
    )
    {
        // Default: swallow. Subclasses can override to log or rethrow.
    }

    /// <inheritdoc/>
    protected override async ValueTask<object?> InvokeFunctionAsync(
        FunctionInvocationContext context,
        CancellationToken cancellationToken
    )
    {
        var argsJson = context.Arguments is { Count: > 0 }
            ? JsonSerializer.Serialize(context.Arguments)
            : null;

        // ── Emit tool_start via unified stream ──
        if (OnStreamEvent is { } streamHandler)
        {
            await streamHandler(ConversationStreamEvent.ToolCallStart(
                context.Function.Name,
                context.CallContent.CallId,
                argsJson
            ));
        }

        // ── Raise legacy "starting" event ──
        var startingHandler = ToolCallStarting;
        if (startingHandler is not null)
        {
            var startingArgs = new ToolCallStartingEventArgs
            {
                FunctionName = context.Function.Name,
                CallId = context.CallContent.CallId,
                Arguments = context.Arguments,
                Iteration = context.Iteration,
                FunctionCallIndex = context.FunctionCallIndex,
                FunctionCount = context.FunctionCount,
                IsStreaming = context.IsStreaming,
                Context = context,
            };

            foreach (var d in startingHandler.GetInvocationList())
            {
                await ((Func<object, ToolCallStartingEventArgs, Task>)d)(this, startingArgs);
            }
        }

        // ── Invoke the function ──
        var stopwatch = Stopwatch.StartNew();
        object? result = null;
        Exception? caughtException = null;

        try
        {
            result = await base.InvokeFunctionAsync(context, cancellationToken);
            return result;
        }
        catch (Exception ex)
        {
            caughtException = ex;
            throw;
        }
        finally
        {
            stopwatch.Stop();
            var durationMs = (long)stopwatch.Elapsed.TotalMilliseconds;
            var resultStr = result?.ToString()?.Truncate(10000);
            var errorStr = caughtException?.Message;

            // ── Emit tool_end via unified stream ──
            if (OnStreamEvent is { } endHandler)
            {
                try
                {
                    await endHandler(ConversationStreamEvent.ToolCallEnd(
                        context.CallContent.CallId,
                        resultStr,
                        errorStr,
                        durationMs
                    ));
                }
                catch { /* swallow handler errors in finally */ }
            }

            // ── Raise legacy "completed" event ──
            var completedHandler = ToolCallCompleted;
            if (completedHandler is not null)
            {
                var completedArgs = new ToolCallCompletedEventArgs
                {
                    FunctionName = context.Function.Name,
                    CallId = context.CallContent.CallId,
                    Result = result,
                    Exception = caughtException,
                    Duration = stopwatch.Elapsed,
                    Iteration = context.Iteration,
                    IsStreaming = context.IsStreaming,
                    TerminationRequested = context.Terminate,
                    Context = context,
                };

                try
                {
                    foreach (var d in completedHandler.GetInvocationList())
                    {
                        await ((Func<object, ToolCallCompletedEventArgs, Task>)d)(
                            this,
                            completedArgs
                        );
                    }
                }
                catch (Exception handlerEx)
                {
                    OnCompletedHandlerException(handlerEx, caughtException);

#pragma warning disable S1163, CA2219
                    if (caughtException is null)
                    {
                        throw;
                    }
#pragma warning restore S1163, CA2219
                }
            }
        }
    }
}
