using Microsoft.AspNetCore.Http;
using Clarive.AI.Pipeline;
using System.Text.Json;

namespace Clarive.Core.Helpers;

/// <summary>
/// Writes Server-Sent Events (SSE) to an HTTP response stream.
/// Used by AI generation endpoints to send real-time progress updates.
/// </summary>
public sealed class SseProgressWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly HttpResponse _response;

    public SseProgressWriter(HttpResponse response)
    {
        _response = response;
    }

    public async Task InitAsync(CancellationToken ct = default)
    {
        _response.ContentType = "text/event-stream";
        _response.Headers.CacheControl = "no-cache";
        _response.Headers.Connection = "keep-alive";
        await _response.Body.FlushAsync(ct);
    }

    public async Task WriteProgressAsync(
        ProgressEvent progress,
        CancellationToken ct = default
    )
    {
        var json = JsonSerializer.Serialize(progress, JsonOptions);
        await WriteEventAsync("progress", json, ct);
    }

    public async Task WriteDoneAsync<T>(T result, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(result, JsonOptions);
        await WriteEventAsync("done", json, ct);
    }

    public async Task WriteChunkAsync<T>(T chunk, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(chunk, JsonOptions);
        await WriteEventAsync("progress", json, ct);
    }

    public async Task WriteErrorAsync(string code, string message, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(new { code, message }, JsonOptions);
        await WriteEventAsync("error", json, ct);
    }

    private async Task WriteEventAsync(string eventType, string data, CancellationToken ct)
    {
        await _response.WriteAsync($"event: {eventType}\ndata: {data}\n\n", ct);
        await _response.Body.FlushAsync(ct);
    }
}
