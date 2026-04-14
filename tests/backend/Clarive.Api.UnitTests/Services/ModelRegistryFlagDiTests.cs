using Clarive.Application;
using Clarive.Application.AiProviders.Services;
using Clarive.Domain.Interfaces.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace Clarive.Api.UnitTests.Services;

public class ModelRegistryFlagDiTests
{
    [Fact]
    public void FlagOff_ResolvesLegacyLookup()
    {
        var services = BuildServices(enabled: false);
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var lookup = scope.ServiceProvider.GetRequiredService<IModelRegistryLookup>();
        lookup.Should().BeOfType<LegacyLiteLlmRegistryLookup>();
    }

    [Fact]
    public void FlagOn_ResolvesServiceLookup()
    {
        var services = BuildServices(enabled: true);
        services.AddSingleton(Substitute.For<ModelCatalog.Client.IModelCatalogClient>());
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var lookup = scope.ServiceProvider.GetRequiredService<IModelRegistryLookup>();
        lookup.Should().BeOfType<ModelRegistryServiceLookup>();
    }

    private static ServiceCollection BuildServices(bool enabled)
    {
        var services = new ServiceCollection();
        services.AddSingleton<ILiteLlmRegistryCache>(
            Substitute.For<ILiteLlmRegistryCache>()
        );
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["ModelRegistry:Enabled"] = enabled.ToString(),
                }
            )
            .Build();
        var useNewRegistry = cfg.GetValue("ModelRegistry:Enabled", defaultValue: false);
        if (useNewRegistry)
            services.AddScoped<IModelRegistryLookup, ModelRegistryServiceLookup>();
        else
            services.AddScoped<IModelRegistryLookup, LegacyLiteLlmRegistryLookup>();
        return services;
    }
}
