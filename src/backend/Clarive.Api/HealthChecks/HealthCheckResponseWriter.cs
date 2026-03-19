using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Clarive.Api.HealthChecks;

public static class HealthCheckResponseWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public static async Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";

        var result = new
        {
            status = report.Status.ToString().ToLowerInvariant(),
            totalDuration = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString().ToLowerInvariant(),
                duration = e.Value.Duration.TotalMilliseconds,
                description = e.Value.Description,
                error = e.Value.Exception?.Message,
            }),
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(result, JsonOptions));
    }
}
