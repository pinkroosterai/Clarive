using System.Threading.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace Clarive.Api.Middleware;

/// <summary>
/// Rate-limits /public/v1/ requests per API key with X-RateLimit-* response headers.
/// Runs after authentication so the apiKeyId claim is available.
/// Uses MemoryCache with sliding expiration to evict stale limiters.
/// </summary>
public class PublicApiRateLimitMiddleware(
    RequestDelegate next,
    IConfiguration configuration,
    ILoggerFactory loggerFactory) : IDisposable
{
    private readonly ILogger _logger = loggerFactory.CreateLogger("PublicApiRateLimiter");

    private readonly int _permitLimit = configuration.GetValue("RateLimiting:PublicApiPermitLimit", 600);
    private readonly int _windowMinutes = configuration.GetValue("RateLimiting:PublicApiWindowMinutes", 1);

    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 10_000 });

    public void Dispose() => _cache.Dispose();

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

        var limiter = _cache.GetOrCreate(partitionKey, entry =>
        {
            entry.Size = 1;
            entry.SlidingExpiration = TimeSpan.FromHours(1);
            entry.RegisterPostEvictionCallback(static (_, value, _, _) =>
            {
                if (value is FixedWindowRateLimiter l)
                    l.Dispose();
            });
            return new FixedWindowRateLimiter(new FixedWindowRateLimiterOptions
            {
                PermitLimit = _permitLimit,
                Window = TimeSpan.FromMinutes(_windowMinutes),
                QueueLimit = 0,
                AutoReplenishment = true
            });
        })!;

        using var lease = limiter.AttemptAcquire();
        var stats = limiter.GetStatistics();
        var remaining = stats?.CurrentAvailablePermits ?? 0;
        var windowSeconds = _windowMinutes * 60;
        var resetEpoch = DateTimeOffset.UtcNow.AddSeconds(windowSeconds).ToUnixTimeSeconds();

        // Always add rate limit headers
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-RateLimit-Limit"] = _permitLimit.ToString();
            context.Response.Headers["X-RateLimit-Remaining"] = remaining.ToString();
            context.Response.Headers["X-RateLimit-Reset"] = resetEpoch.ToString();
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
        context.Response.Headers["Retry-After"] = windowSeconds.ToString();
        await context.Response.WriteAsJsonAsync(new
        {
            error = new { code = "RATE_LIMITED", message = "Too many requests. Try again later." }
        });
    }
}
