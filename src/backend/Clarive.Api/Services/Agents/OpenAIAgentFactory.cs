using System.ClientModel;
using Clarive.Api.Models.Agents;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Creates AIAgent instances backed by OpenAI-compatible models.
/// Singleton lifetime — holds the OpenAI clients and hot-reloads on config change.
/// </summary>
public class OpenAIAgentFactory : IAgentFactory, IDisposable
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<OpenAIAgentFactory> _logger;
    private readonly ReaderWriterLockSlim _lock = new();
    private readonly IDisposable? _changeSubscription;

    private IChatClient? _premiumClient;
    private IChatClient? _defaultClient;
    private bool _isConfigured;

    public bool IsConfigured
    {
        get
        {
            _lock.EnterReadLock();
            try { return _isConfigured; }
            finally { _lock.ExitReadLock(); }
        }
    }

    public event Action? OnReconfigured;

    public OpenAIAgentFactory(IOptionsMonitor<AiSettings> optionsMonitor, ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        _logger = loggerFactory.CreateLogger<OpenAIAgentFactory>();

        ReinitializeClients(optionsMonitor.CurrentValue);

        _changeSubscription = optionsMonitor.OnChange((newSettings, _) =>
        {
            _logger.LogInformation("AI settings changed, reinitializing clients");
            ReinitializeClients(newSettings);
        });
    }

    public AIAgent CreateGenerationAgent(GenerationConfig config, IList<AITool>? tools = null)
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _premiumClient!.AsAIAgent(
                instructions: AgentInstructions.BuildGeneration(config),
                name: "PromptGenerator",
                tools: tools,
                loggerFactory: _loggerFactory);
        }
        finally { _lock.ExitReadLock(); }
    }

    public AIAgent CreateEvaluationAgent(GenerationConfig config)
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _defaultClient!.AsAIAgent(
                instructions: AgentInstructions.BuildEvaluation(config),
                name: "PromptEvaluator",
                loggerFactory: _loggerFactory);
        }
        finally { _lock.ExitReadLock(); }
    }

    public AIAgent CreateClarificationAgent()
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _defaultClient!.AsAIAgent(
                instructions: AgentInstructions.Clarification,
                name: "PromptClarifier",
                loggerFactory: _loggerFactory);
        }
        finally { _lock.ExitReadLock(); }
    }

    public AIAgent CreatePreGenClarificationAgent()
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _defaultClient!.AsAIAgent(
                instructions: AgentInstructions.PreGenerationClarification,
                name: "PreGenClarifier",
                loggerFactory: _loggerFactory);
        }
        finally { _lock.ExitReadLock(); }
    }

    public AIAgent CreateSystemMessageAgent()
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _defaultClient!.AsAIAgent(
                instructions: AgentInstructions.SystemMessage,
                name: "SystemMessageGenerator",
                loggerFactory: _loggerFactory);
        }
        finally { _lock.ExitReadLock(); }
    }

    public AIAgent CreateDecomposeAgent()
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _defaultClient!.AsAIAgent(
                instructions: AgentInstructions.Decompose,
                name: "PromptDecomposer",
                loggerFactory: _loggerFactory);
        }
        finally { _lock.ExitReadLock(); }
    }

    internal static OpenAIClient CreateOpenAIClient(string apiKey, string? endpointUrl)
    {
        if (!string.IsNullOrWhiteSpace(endpointUrl))
        {
            return new OpenAIClient(
                new ApiKeyCredential(apiKey),
                new OpenAIClientOptions { Endpoint = new Uri(endpointUrl) });
        }

        return new OpenAIClient(apiKey);
    }

    private void ReinitializeClients(AiSettings settings)
    {
        _lock.EnterWriteLock();
        try
        {
            (_premiumClient as IDisposable)?.Dispose();
            (_defaultClient as IDisposable)?.Dispose();
            _premiumClient = null;
            _defaultClient = null;
            _isConfigured = false;

            if (!string.IsNullOrWhiteSpace(settings.OpenAiApiKey))
            {
                var openAiClient = CreateOpenAIClient(settings.OpenAiApiKey, settings.EndpointUrl);
                _premiumClient = openAiClient.GetChatClient(settings.PremiumModel).AsIChatClient();
                _defaultClient = openAiClient.GetChatClient(settings.DefaultModel).AsIChatClient();
                _isConfigured = true;

                _logger.LogInformation(
                    "AI clients initialized (endpoint: {Endpoint}, default: {Default}, premium: {Premium})",
                    string.IsNullOrWhiteSpace(settings.EndpointUrl) ? "OpenAI default" : settings.EndpointUrl,
                    settings.DefaultModel,
                    settings.PremiumModel);
            }
            else
            {
                _logger.LogWarning("AI clients not configured — no API key provided");
            }
        }
        finally { _lock.ExitWriteLock(); }

        OnReconfigured?.Invoke();
    }

    private void EnsureConfigured()
    {
        if (!_isConfigured)
            throw new InvalidOperationException("AI features are not configured. Set the Ai:OpenAiApiKey setting.");
    }

    public void Dispose()
    {
        _changeSubscription?.Dispose();
        _lock.EnterWriteLock();
        try
        {
            (_premiumClient as IDisposable)?.Dispose();
            (_defaultClient as IDisposable)?.Dispose();
            _premiumClient = null;
            _defaultClient = null;
        }
        finally { _lock.ExitWriteLock(); }
        _lock.Dispose();
    }
}
