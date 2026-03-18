using System.Collections.Concurrent;
using System.Threading.RateLimiting;

namespace Clarive.Api.Middleware;

/// <summary>
/// Rate-limits /public/v1/ requests per API key with X-RateLimit-* response headers.
/// Runs after authentication so the apiKeyId claim is available.
/// </summary>
public class PublicApiRateLimitMiddleware(
    RequestDelegate next,
    IConfiguration configuration,
    ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger("PublicApiRateLimiter");

    private readonly int _permitLimit = configuration.GetValue("RateLimiting:PublicApiPermitLimit", 600);
    private readonly int _windowMinutes = configuration.GetValue("RateLimiting:PublicApiWindowMinutes", 1);

    private readonly ConcurrentDictionary<string, FixedWindowRateLimiter> _limiters = new();

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/public/v1"))
        {
            await next(context);
            return;
        }

        var partitionKey = context.User.FindFirst("apiKeyId")?.Value
            ?? context.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        var limiter = _limiters.GetOrAdd(partitionKey, _ => new FixedWindowRateLimiter(
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = _permitLimit,
                Window = TimeSpan.FromMinutes(_windowMinutes),
                QueueLimit = 0,
                AutoReplenishment = true
            }));

        using var lease = limiter.AttemptAcquire();
        var stats = limiter.GetStatistics();
        var remaining = stats?.CurrentAvailablePermits ?? 0;
        var resetSeconds = _windowMinutes * 60;

        // Always add rate limit headers
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-RateLimit-Limit"] = _permitLimit.ToString();
            context.Response.Headers["X-RateLimit-Remaining"] = remaining.ToString();
            context.Response.Headers["X-RateLimit-Reset"] = resetSeconds.ToString();
            return Task.CompletedTask;
        });

        if (lease.IsAcquired)
        {
            await next(context);
            return;
        }

        // Rejected
        _logger.LogWarning(
            "Public API rate limit exceeded for key {PartitionKey} on {Method} {Path}",
            partitionKey, context.Request.Method, context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.Headers["Retry-After"] = resetSeconds.ToString();
        await context.Response.WriteAsJsonAsync(new
        {
            error = new { code = "RATE_LIMITED", message = "Too many requests. Try again later." }
        });
    }
}
