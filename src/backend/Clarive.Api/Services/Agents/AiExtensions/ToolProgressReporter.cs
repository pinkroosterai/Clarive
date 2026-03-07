namespace Clarive.Api.Services.Agents.AiExtensions;

/// <summary>
/// Mutable callback holder for tool progress reporting.
/// Set before agent execution, cleared after.
/// </summary>
public sealed class ToolProgressReporter
{
    public Func<ProgressEvent, Task>? OnProgress { get; set; }
}
