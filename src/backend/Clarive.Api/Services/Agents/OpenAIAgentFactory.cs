using System.ClientModel;
using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Entities;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents.AiExtensions;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Creates AIAgent instances backed by OpenAI-compatible models.
/// Singleton lifetime — holds the OpenAI clients and hot-reloads on config change.
/// Resolves API credentials from AI providers in the database.
/// </summary>
public class OpenAIAgentFactory : IAgentFactory, IDisposable
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<OpenAIAgentFactory> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEncryptionService _encryption;
    private readonly ReaderWriterLockSlim _lock = new();
    private readonly IDisposable? _changeSubscription;

    private OpenAIClient? _openAiClient;
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

    public OpenAIAgentFactory(
        IOptionsMonitor<AiSettings> optionsMonitor,
        IServiceScopeFactory scopeFactory,
        IEncryptionService encryption,
        ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        _logger = loggerFactory.CreateLogger<OpenAIAgentFactory>();
        _scopeFactory = scopeFactory;
        _encryption = encryption;

        ReinitializeClients(optionsMonitor.CurrentValue);

        _changeSubscription = optionsMonitor.OnChange((newSettings, _) =>
        {
            _logger.LogInformation("AI settings changed, reinitializing clients");
            ReinitializeClients(newSettings);
        });
    }

    public (AIAgent Agent, ToolProgressReporter? ToolProgress) CreateGenerationAgent(GenerationConfig config, IList<AITool>? tools = null)
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();

            if (tools is { Count: > 0 })
            {
                var reporter = new ToolProgressReporter();
                var handler = new TavilyToolProgressHandler(reporter);

                var pipeline = new ChatClientBuilder(_premiumClient!)
                    .Use(innerClient =>
                    {
                        var eefic = new EventEmittingFunctionInvokingChatClient(
                            innerClient, _loggerFactory);
                        eefic.ToolCallStarting += handler.OnToolCallStartingAsync;
                        eefic.ToolCallCompleted += handler.OnToolCallCompletedAsync;
                        return eefic;
                    })
                    .Build();

                var agent = pipeline.AsAIAgent(
                    instructions: AgentInstructions.BuildGeneration(config),
                    name: "PromptGenerator",
                    tools: tools,
                    loggerFactory: _loggerFactory);

                return (agent, reporter);
            }

            var standardAgent = _premiumClient!.AsAIAgent(
                instructions: AgentInstructions.BuildGeneration(config),
                name: "PromptGenerator",
                loggerFactory: _loggerFactory);

            return (standardAgent, null);
        }
        finally { _lock.ExitReadLock(); }
    }

    public AIAgent CreateEvaluationAgent(GenerationConfig config)
        => CreateDefaultAgent(AgentInstructions.BuildEvaluation(config), "PromptEvaluator");

    public AIAgent CreateClarificationAgent()
        => CreateDefaultAgent(AgentInstructions.Clarification, "PromptClarifier");

    public AIAgent CreateSystemMessageAgent()
        => CreateDefaultAgent(AgentInstructions.SystemMessage, "SystemMessageGenerator");

    public AIAgent CreateDecomposeAgent()
        => CreateDefaultAgent(AgentInstructions.Decompose, "PromptDecomposer");

    private ChatClientAgent CreateDefaultAgent(string instructions, string name)
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _defaultClient!.AsAIAgent(
                instructions: instructions,
                name: name,
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
            _openAiClient = null;
            _isConfigured = false;

            if (string.IsNullOrWhiteSpace(settings.DefaultModel) ||
                string.IsNullOrWhiteSpace(settings.PremiumModel))
            {
                _logger.LogWarning("AI not configured — Default or Premium model not set");
                return;
            }

            List<AiProvider> providers;
            try
            {
                providers = Task.Run(() => LoadProvidersAsync()).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load AI providers — AI features unavailable");
                return;
            }

            var defaultResolved = ResolveProviderForModel(providers, settings.DefaultModel);
            var premiumResolved = ResolveProviderForModel(providers, settings.PremiumModel);

            if (defaultResolved is null || premiumResolved is null)
            {
                _logger.LogWarning("AI not configured — no active provider found for {Missing} model",
                    defaultResolved is null ? "default" : "premium");
                return;
            }

            var premiumOpenAiClient = CreateOpenAIClient(premiumResolved.ApiKey, premiumResolved.EndpointUrl);
            var defaultOpenAiClient = premiumResolved == defaultResolved
                ? premiumOpenAiClient
                : CreateOpenAIClient(defaultResolved.ApiKey, defaultResolved.EndpointUrl);

            _openAiClient = premiumOpenAiClient;
            _premiumClient = premiumOpenAiClient.GetChatClient(settings.PremiumModel).AsIChatClient();
            _defaultClient = defaultOpenAiClient.GetChatClient(settings.DefaultModel).AsIChatClient();
            _isConfigured = true;

            _logger.LogInformation(
                "AI clients initialized (default: {Default} via {DefaultProvider}, premium: {Premium} via {PremiumProvider})",
                settings.DefaultModel, defaultResolved.ProviderName,
                settings.PremiumModel, premiumResolved.ProviderName);
        }
        finally { _lock.ExitWriteLock(); }

        OnReconfigured?.Invoke();
    }

    private async Task<List<AiProvider>> LoadProvidersAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IAiProviderRepository>();
        return await repo.GetAllAsync();
    }

    private record ResolvedProvider(string ApiKey, string? EndpointUrl, string ProviderName);

    private ResolvedProvider? ResolveProviderForModel(List<AiProvider> providers, string modelId)
    {
        var match = providers
            .Where(p => p.IsActive)
            .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
            .FirstOrDefault(x => x.Model.IsActive &&
                x.Model.ModelId.Equals(modelId, StringComparison.OrdinalIgnoreCase));

        if (match is null || !_encryption.IsAvailable) return null;

        var apiKey = _encryption.Decrypt(match.Provider.ApiKeyEncrypted);
        return new ResolvedProvider(apiKey, match.Provider.EndpointUrl, match.Provider.Name);
    }

    public IChatClient CreateChatClient(string model)
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
#pragma warning disable OPENAI001 // Responses API is experimental
            return _openAiClient!.GetResponsesClient(model).AsIChatClient();
#pragma warning restore OPENAI001
        }
        finally { _lock.ExitReadLock(); }
    }

    public IChatClient CreateChatClientForProvider(string apiKey, string? endpointUrl, string model)
    {
        var client = CreateOpenAIClient(apiKey, endpointUrl);
#pragma warning disable OPENAI001 // Responses API is experimental
        return client.GetResponsesClient(model).AsIChatClient();
#pragma warning restore OPENAI001
    }

    public OpenAIClient GetOpenAIClient()
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _openAiClient!;
        }
        finally { _lock.ExitReadLock(); }
    }

    private void EnsureConfigured()
    {
        if (!_isConfigured)
            throw new InvalidOperationException(
                "AI features are not configured. Add an AI provider with models and set the Default/Premium model in Super Admin > AI.");
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
