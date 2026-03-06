using Clarive.Api.Models.Agents;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Creates AIAgent instances backed by OpenAI models.
/// Singleton lifetime — holds the OpenAIClient for reuse.
/// </summary>
public class OpenAIAgentFactory : IAgentFactory
{
    private readonly IChatClient? _premiumClient;
    private readonly IChatClient? _defaultClient;
    private readonly ILoggerFactory _loggerFactory;

    public bool IsConfigured { get; }

    public OpenAIAgentFactory(IOptions<AiSettings> settings, ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        var aiSettings = settings.Value;

        if (!string.IsNullOrWhiteSpace(aiSettings.OpenAiApiKey))
        {
            var openAiClient = new OpenAIClient(aiSettings.OpenAiApiKey);
            _premiumClient = openAiClient.GetChatClient(aiSettings.PremiumModel).AsIChatClient();
            _defaultClient = openAiClient.GetChatClient(aiSettings.DefaultModel).AsIChatClient();
            IsConfigured = true;
        }
    }

    public AIAgent CreateGenerationAgent(GenerationConfig config)
    {
        EnsureConfigured();
        return _premiumClient!.AsAIAgent(
            instructions: AgentInstructions.BuildGeneration(config),
            name: "PromptGenerator",
            loggerFactory: _loggerFactory);
    }

    public AIAgent CreateEvaluationAgent(GenerationConfig config)
    {
        EnsureConfigured();
        return _defaultClient!.AsAIAgent(
            instructions: AgentInstructions.BuildEvaluation(config),
            name: "PromptEvaluator",
            loggerFactory: _loggerFactory);
    }

    public AIAgent CreateClarificationAgent()
    {
        EnsureConfigured();
        return _defaultClient!.AsAIAgent(
            instructions: AgentInstructions.Clarification,
            name: "PromptClarifier",
            loggerFactory: _loggerFactory);
    }

    public AIAgent CreatePreGenClarificationAgent()
    {
        EnsureConfigured();
        return _defaultClient!.AsAIAgent(
            instructions: AgentInstructions.PreGenerationClarification,
            name: "PreGenClarifier",
            loggerFactory: _loggerFactory);
    }

    public AIAgent CreateSystemMessageAgent()
    {
        EnsureConfigured();
        return _defaultClient!.AsAIAgent(
            instructions: AgentInstructions.SystemMessage,
            name: "SystemMessageGenerator",
            loggerFactory: _loggerFactory);
    }

    public AIAgent CreateDecomposeAgent()
    {
        EnsureConfigured();
        return _defaultClient!.AsAIAgent(
            instructions: AgentInstructions.Decompose,
            name: "PromptDecomposer",
            loggerFactory: _loggerFactory);
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
            throw new InvalidOperationException("AI features are not configured. Set the Ai:OpenAiApiKey setting.");
    }
}
