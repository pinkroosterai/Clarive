using System.Text.Json;
using Clarive.AI.Models;
using Humanizer;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Pipeline;

/// <summary>
/// Subscribes to <see cref="EventEmittingFunctionInvokingChatClient"/> events
/// and forwards user-friendly MCP tool progress events to a <see cref="ToolProgressReporter"/>.
/// Also collects <see cref="ToolInvocation"/> records for persistence.
/// </summary>
public sealed class McpToolProgressHandler
{
    private readonly ToolProgressReporter _reporter;
    private readonly List<ToolInvocation> _invocations = [];
    private readonly Dictionary<string, (string ToolName, string? Arguments, DateTime StartedAt)> _pending = [];

    public McpToolProgressHandler(ToolProgressReporter reporter)
    {
        _reporter = reporter;
    }

    public IReadOnlyList<ToolInvocation> Invocations => _invocations;

    public async Task OnToolCallStartingAsync(object sender, ToolCallStartingEventArgs e)
    {
        var argsJson = e.Arguments is { Count: > 0 }
            ? JsonSerializer.Serialize(e.Arguments)
            : null;

        _pending[e.CallId] = (e.FunctionName, argsJson, DateTime.UtcNow);

        if (_reporter.OnProgress is not { } callback)
            return;

        var detail = argsJson is not null ? argsJson.Truncate(120) : null;
        await callback(ProgressEvent.ToolStart(
            e.CallId,
            "\U0001f527",
            $"Calling {e.FunctionName}\u2026",
            detail
        ));
    }

    public async Task OnToolCallCompletedAsync(object sender, ToolCallCompletedEventArgs e)
    {
        var response = e.Result?.ToString();
        var durationMs = (long)e.Duration.TotalMilliseconds;
        var error = e.Exception?.Message;

        if (_pending.Remove(e.CallId, out var pending))
        {
            _invocations.Add(new ToolInvocation(
                pending.ToolName,
                e.CallId,
                pending.Arguments,
                response,
                durationMs,
                error
            ));
        }

        if (_reporter.OnProgress is not { } callback)
            return;

        await callback(ProgressEvent.ToolEnd(e.CallId));
    }
}
