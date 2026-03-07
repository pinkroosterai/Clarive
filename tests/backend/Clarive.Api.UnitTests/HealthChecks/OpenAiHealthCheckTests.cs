using Clarive.Api.HealthChecks;
using Clarive.Api.Services.Agents;
using FluentAssertions;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using NSubstitute;

namespace Clarive.Api.UnitTests.HealthChecks;

public class OpenAiHealthCheckTests
{
    [Fact]
    public async Task CheckHealthAsync_Configured_ReturnsHealthy()
    {
        var factory = Substitute.For<IAgentFactory>();
        factory.IsConfigured.Returns(true);

        var check = new OpenAiHealthCheck(factory);
        var result = await check.CheckHealthAsync(null!);

        result.Status.Should().Be(HealthStatus.Healthy);
        result.Description.Should().Contain("configured");
    }

    [Fact]
    public async Task CheckHealthAsync_NotConfigured_ReturnsDegraded()
    {
        var factory = Substitute.For<IAgentFactory>();
        factory.IsConfigured.Returns(false);

        var check = new OpenAiHealthCheck(factory);
        var result = await check.CheckHealthAsync(null!);

        result.Status.Should().Be(HealthStatus.Degraded);
        result.Description.Should().Contain("not configured");
    }
}
