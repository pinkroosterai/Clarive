using Clarive.Api.Services.Agents;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Clarive.Api.HealthChecks;

public sealed class OpenAiHealthCheck(IAgentFactory agentFactory) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default
    )
    {
        var result = agentFactory.IsConfigured
            ? HealthCheckResult.Healthy("OpenAI agent factory is configured.")
            : HealthCheckResult.Degraded("OpenAI is not configured — AI features disabled.");

        return Task.FromResult(result);
    }
}
