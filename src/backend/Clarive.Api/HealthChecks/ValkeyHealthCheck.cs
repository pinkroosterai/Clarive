using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Clarive.Api.HealthChecks;

public sealed class ValkeyHealthCheck(IDistributedCache cache) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var testKey = "health:ping";
            await cache.SetStringAsync(testKey, "pong", new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(10)
            }, cancellationToken);

            var value = await cache.GetStringAsync(testKey, cancellationToken);
            return value == "pong"
                ? HealthCheckResult.Healthy("Valkey is responding.")
                : HealthCheckResult.Degraded("Valkey returned unexpected value.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded("Valkey is unavailable.", ex);
        }
    }
}
