namespace Clarive.Api.Services.Agents.AiExtensions;

/// <summary>
/// A structured progress event sent to the client via SSE during AI operations.
/// </summary>
public sealed record ProgressEvent(
    string Type,
    string Id,
    string Icon,
    string Message,
    string? Detail = null)
{
    // ── Pipeline stage factories ──

    public static ProgressEvent Generating() =>
        new("stage", "stage-generating", "\U0001f9e0", "Generating your prompt\u2026");

    public static ProgressEvent Evaluating() =>
        new("stage", "stage-evaluating", "\U0001f4ca", "Evaluating quality\u2026");

    public static ProgressEvent Refining() =>
        new("stage", "stage-refining", "\u2728", "Refining your prompt\u2026");

    public static ProgressEvent Bootstrapping() =>
        new("stage", "stage-bootstrapping", "\U0001f4cb", "Analyzing existing entry\u2026");

    public static ProgressEvent Clarifying() =>
        new("stage", "stage-clarifying", "\U0001f4ac", "Generating questions & suggestions\u2026");

    // ── Tool event factories ──

    public static ProgressEvent ToolStart(string callId, string icon, string message, string? detail = null) =>
        new("tool_start", callId, icon, message, detail);

    public static ProgressEvent ToolEnd(string callId) =>
        new("tool_end", callId, "", "");
}
