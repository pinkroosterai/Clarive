using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace Clarive.AI.Pipeline;

/// <summary>
/// A <see cref="FunctionInvokingChatClient"/> that emits a unified stream of conversation events
/// covering tool call starts and tool call completions.
/// Tool events flow through <see cref="OnStreamEvent"/> in chronological order.
/// Text and reasoning events are NOT emitted by this class — they are emitted by the caller
/// (PlaygroundService) as it processes streaming updates from GetStreamingResponseAsync.
/// </summary>
/// <remarks>
/// <para>
/// <strong>Important:</strong> Do not set <see cref="FunctionInvokingChatClient.FunctionInvoker"/>
/// on this class. The base class may route invocations through that delegate, bypassing
/// <see cref="InvokeFunctionAsync"/> and the event emission logic.
/// </para>
/// </remarks>
public class EventEmittingFunctionInvokingChatClient : FunctionInvokingChatClient
{
    private readonly ILogger? _logger;

    /// <summary>
    /// Single callback for conversation stream events (tool calls).
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
        : base(innerClient, loggerFactory, functionInvocationServices)
    {
        _logger = loggerFactory?.CreateLogger<EventEmittingFunctionInvokingChatClient>();
    }

    /// <summary>
    /// Called when a <see cref="ToolCallCompleted"/> handler throws inside the <c>finally</c> block.
    /// Logs the failure by default. Subclasses can override.
    /// </summary>
    protected virtual void OnCompletedHandlerException(
        Exception handlerException,
        Exception? functionException
    )
    {
        _logger?.LogWarning(
            handlerException,
            "ToolCallCompleted handler threw (function exception: {FunctionError})",
            functionException?.Message ?? "none"
        );
    }

    /// <inheritdoc/>
    protected override async ValueTask<object?> InvokeFunctionAsync(
        FunctionInvocationContext context,
        CancellationToken cancellationToken
    )
    {
        // ── Defensive: ensure CallId is never null ──
        var callId = context.CallContent.CallId ?? $"synthetic-{Guid.NewGuid():N}";

        // ── Serialize arguments safely ──
        string? argsJson = null;
        try
        {
            if (context.Arguments is { Count: > 0 })
                argsJson = JsonSerializer.Serialize(context.Arguments);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Failed to serialize arguments for {FunctionName}", context.Function.Name);
            argsJson = $"{{\"_serializationError\": \"{ex.Message}\"}}";
        }

        // ── Emit tool_start via unified stream ──
        var toolStartEmitted = false;
        try
        {
            if (OnStreamEvent is { } streamHandler)
            {
                await streamHandler(ConversationStreamEvent.ToolCallStart(
                    context.Function.Name,
                    callId,
                    argsJson
                ));
                toolStartEmitted = true;
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "OnStreamEvent handler threw on tool_start for {FunctionName}", context.Function.Name);
        }

        // ── Raise legacy "starting" event ──
        var startingHandler = ToolCallStarting;
        if (startingHandler is not null)
        {
            var startingArgs = new ToolCallStartingEventArgs
            {
                FunctionName = context.Function.Name,
                CallId = callId,
                Arguments = context.Arguments,
                Iteration = context.Iteration,
                FunctionCallIndex = context.FunctionCallIndex,
                FunctionCount = context.FunctionCount,
                IsStreaming = context.IsStreaming,
                Context = context,
            };

            try
            {
                foreach (var d in startingHandler.GetInvocationList())
                {
                    await ((Func<object, ToolCallStartingEventArgs, Task>)d)(this, startingArgs);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "ToolCallStarting handler threw for {FunctionName}", context.Function.Name);
            }
        }

        // ── Invoke the function ──
        // Wrapped in try/finally that guarantees tool_end emission whenever tool_start was sent
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
            var resultStr = SerializeResult(result);
            var errorStr = caughtException?.Message;

            // ── Emit tool_end — guaranteed if tool_start was emitted ──
            if (toolStartEmitted && OnStreamEvent is { } endHandler)
            {
                try
                {
                    await endHandler(ConversationStreamEvent.ToolCallEnd(
                        callId,
                        resultStr,
                        errorStr,
                        durationMs
                    ));
                }
                catch (Exception ex)
                {
                    _logger?.LogWarning(ex, "OnStreamEvent handler threw on tool_end for {FunctionName}", context.Function.Name);
                }
            }

            // ── Raise legacy "completed" event ──
            var completedHandler = ToolCallCompleted;
            if (completedHandler is not null)
            {
                var completedArgs = new ToolCallCompletedEventArgs
                {
                    FunctionName = context.Function.Name,
                    CallId = callId,
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

    /// <summary>
    /// Serializes a function result to a meaningful string.
    /// Tries JSON serialization first, falls back to ToString().
    /// </summary>
    private static string? SerializeResult(object? result)
    {
        if (result is null) return null;
        if (result is string s) return s;

        try
        {
            return JsonSerializer.Serialize(result);
        }
        catch
        {
            return result.ToString();
        }
    }
}
