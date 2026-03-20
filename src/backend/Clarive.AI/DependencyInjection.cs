using Clarive.AI.Agents;
using Clarive.AI.Configuration;
using Clarive.AI.Orchestration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Clarive.AI;

public static class DependencyInjection
{
    public static IServiceCollection AddClariveAI(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ── Settings ──
        services.Configure<AiSettings>(configuration.GetSection("Ai"));

        // ── Agent orchestration ──
        services.AddSingleton<IAiProviderResolver, AiProviderResolver>();
        services.AddSingleton<IAgentFactory, OpenAIAgentFactory>();
        services.AddSingleton<IAgentSessionPool, AgentSessionPool>();
        services.AddScoped<IPromptOrchestrator, PromptOrchestrator>();

        return services;
    }
}
