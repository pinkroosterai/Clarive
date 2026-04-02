using Clarive.Domain.ValueObjects;
using Clarive.Domain.Enums;
using Clarive.AI.Pipeline;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Agents;

/// <summary>
/// Creates specialized AI agents for each role in the orchestration pipeline.
/// </summary>
public interface IAgentFactory
{
    (AIAgent Agent, ToolProgressReporter? ToolProgress) CreateGenerationAgent(
        GenerationConfig config,
        IList<AITool>? tools = null
    );
    AIAgent CreateAgent(AiActionType actionType, string instructions, string name);
    IChatClient GetActionChatClient(AiActionType actionType);
    IChatClient CreateChatClient(string model);
    IChatClient CreateChatClientForProvider(
        string apiKey,
        string? endpointUrl,
        string model,
        AiApiMode apiMode = AiApiMode.ResponsesApi,
        Dictionary<string, string>? customHeaders = null
    );
    OpenAI.OpenAIClient GetOpenAIClient();
    bool IsConfigured { get; }
    (string? ModelId, string? ProviderName) GetModelInfo(AiActionType actionType);
    event Action? OnReconfigured;
}
