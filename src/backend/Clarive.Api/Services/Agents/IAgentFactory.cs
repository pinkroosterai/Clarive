using Clarive.Api.Models.Agents;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Enums;
using Clarive.Api.Services.Agents.AiExtensions;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Creates specialized AI agents for each role in the orchestration pipeline.
/// </summary>
public interface IAgentFactory
{
    (AIAgent Agent, ToolProgressReporter? ToolProgress) CreateGenerationAgent(
        GenerationConfig config,
        IList<AITool>? tools = null
    );
    AIAgent CreateEvaluationAgent(GenerationConfig config);
    AIAgent CreateClarificationAgent();
    AIAgent CreateSystemMessageAgent();
    AIAgent CreateDecomposeAgent();
    AIAgent CreateFillTemplateFieldsAgent();
    AIAgent CreatePlaygroundJudgeAgent();
    IChatClient CreateChatClient(string model);
    IChatClient CreateChatClientForProvider(
        string apiKey,
        string? endpointUrl,
        string model,
        AiApiMode apiMode = AiApiMode.ResponsesApi
    );
    OpenAI.OpenAIClient GetOpenAIClient();
    bool IsConfigured { get; }
    (string? ModelId, string? ProviderName) GetModelInfo(AiActionType actionType);
    event Action? OnReconfigured;
}
