using Clarive.Api.Models.Agents;
using Microsoft.Agents.AI;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Creates specialized AI agents for each role in the orchestration pipeline.
/// </summary>
public interface IAgentFactory
{
    AIAgent CreateGenerationAgent(GenerationConfig config);
    AIAgent CreateEvaluationAgent(GenerationConfig config);
    AIAgent CreateClarificationAgent();
    AIAgent CreatePreGenClarificationAgent();
    AIAgent CreateSystemMessageAgent();
    AIAgent CreateDecomposeAgent();
    bool IsConfigured { get; }
    event Action? OnReconfigured;
}
