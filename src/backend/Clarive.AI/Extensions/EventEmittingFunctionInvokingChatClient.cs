using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using System.Diagnostics;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;

namespace Clarive.AI.Extensions;

/// <summary>
/// A <see cref="FunctionInvokingChatClient"/> that emits events before and after each tool invocation.
/// </summary>
/// <remarks>
/// <para>
/// Subscribe to <see cref="ToolCallStarting"/> and <see cref="ToolCallCompleted"/> to observe every
/// function invocation that flows through the pipeline. Both events support asynchronous handlers.
/// </para>
/// <para>
/// <strong>Thread safety:</strong> When <see cref="FunctionInvokingChatClient.AllowConcurrentInvocation"/>
/// is <see langword="true"/>, multiple <see cref="InvokeFunctionAsync"/> calls may execute in parallel.
/// Event handlers must be safe for concurrent invocation or coordinate their own synchronization.
/// </para>
/// </remarks>
public class EventEmittingFunctionInvokingChatClient : FunctionInvokingChatClient
{
    /// <summary>
    /// Raised immediately before a function is invoked.
    /// </summary>
    public event Func<object, ToolCallStartingEventArgs, Task>? ToolCallStarting;

    /// <summary>
    /// Raised after a function invocation completes, whether it succeeded or threw.
    /// </summary>
    public event Func<object, ToolCallCompletedEventArgs, Task>? ToolCallCompleted;

    /// <summary>
    /// Initializes a new instance of the <see cref="EventEmittingFunctionInvokingChatClient"/> class.
    /// </summary>
    public EventEmittingFunctionInvokingChatClient(
        IChatClient innerClient,
        ILoggerFactory? loggerFactory = null,
        IServiceProvider? functionInvocationServices = null
    )
        : base(innerClient, loggerFactory, functionInvocationServices) { }

    /// <summary>
    /// Called when a <see cref="ToolCallCompleted"/> handler throws inside the <c>finally</c> block.
    /// </summary>
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
        // ── Raise "starting" event ──
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

            // ── Raise "completed" event ──
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

                    // If the function itself did NOT throw, propagate the handler
                    // exception so it is not silently lost.
#pragma warning disable S1163, CA2219 // Intentional: re-throw handler exception only when no function exception
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
