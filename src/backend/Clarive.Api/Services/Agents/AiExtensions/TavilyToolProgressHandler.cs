using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Agents.AiExtensions;

/// <summary>
/// Subscribes to <see cref="EventEmittingFunctionInvokingChatClient"/> events
/// and forwards user-friendly Tavily progress events to a <see cref="ToolProgressReporter"/>.
/// </summary>
public sealed class TavilyToolProgressHandler
{
    private static readonly HashSet<string> TavilyTools = new(StringComparer.OrdinalIgnoreCase)
    {
        "tavily_search", "tavily-search",
        "tavily_extract", "tavily-extract",
        "tavily_crawl", "tavily-crawl",
        "tavily_research", "tavily-research",
        "tavily_map", "tavily-map",
    };

    private readonly ToolProgressReporter _reporter;

    public TavilyToolProgressHandler(ToolProgressReporter reporter)
    {
        _reporter = reporter;
    }

    public async Task OnToolCallStartingAsync(object sender, ToolCallStartingEventArgs e)
    {
        if (_reporter.OnProgress is not { } callback) return;
        if (!TavilyTools.Contains(e.FunctionName)) return;

        var evt = FormatStartEvent(e.CallId, e.FunctionName, e.Arguments);
        if (evt is not null)
            await callback(evt);
    }

    public async Task OnToolCallCompletedAsync(object sender, ToolCallCompletedEventArgs e)
    {
        if (_reporter.OnProgress is not { } callback) return;
        if (!TavilyTools.Contains(e.FunctionName)) return;

        await callback(ProgressEvent.ToolEnd(e.CallId));
    }

    private static ProgressEvent? FormatStartEvent(string callId, string toolName, AIFunctionArguments? args)
    {
        var normalized = toolName.Replace('-', '_').ToLowerInvariant();

        return normalized switch
        {
            "tavily_search" => FormatSearch(callId, args),
            "tavily_research" => FormatResearch(callId, args),
            "tavily_extract" => FormatExtract(callId, args),
            "tavily_crawl" => FormatCrawl(callId, args),
            "tavily_map" => FormatMap(callId, args),
            _ => ProgressEvent.ToolStart(callId, "\U0001f310", "Using web tools\u2026")
        };
    }

    private static ProgressEvent FormatSearch(string callId, AIFunctionArguments? args)
    {
        var query = GetArg(args, "query");
        return ProgressEvent.ToolStart(callId, "\U0001f50d", "Searching\u2026", query is not null ? Truncate(query, 80) : null);
    }

    private static ProgressEvent FormatResearch(string callId, AIFunctionArguments? args)
    {
        var query = GetArg(args, "query");
        return ProgressEvent.ToolStart(callId, "\U0001f52c", "Researching\u2026", query is not null ? Truncate(query, 80) : null);
    }

    private static ProgressEvent FormatExtract(string callId, AIFunctionArguments? args)
    {
        var url = GetArg(args, "url") ?? GetArg(args, "urls");
        return ProgressEvent.ToolStart(callId, "\U0001f4c4", "Reading content\u2026", url is not null ? Truncate(url, 60) : null);
    }

    private static ProgressEvent FormatCrawl(string callId, AIFunctionArguments? args)
    {
        var url = GetArg(args, "url");
        return ProgressEvent.ToolStart(callId, "\U0001f577\ufe0f", "Crawling\u2026", url is not null ? Truncate(url, 60) : null);
    }

    private static ProgressEvent FormatMap(string callId, AIFunctionArguments? args)
    {
        var url = GetArg(args, "url");
        return ProgressEvent.ToolStart(callId, "\U0001f5fa\ufe0f", "Mapping site\u2026", url is not null ? Truncate(url, 60) : null);
    }

    private static string? GetArg(AIFunctionArguments? args, string key)
        => args?.TryGetValue(key, out var val) == true ? val?.ToString() : null;

    private static string Truncate(string s, int max)
        => s.Length <= max ? s : string.Concat(s.AsSpan(0, max - 1), "\u2026");
}
