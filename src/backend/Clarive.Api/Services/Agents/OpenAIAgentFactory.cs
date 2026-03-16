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
    private string? _defaultModelId;
    private string? _defaultProviderName;
    private string? _premiumModelId;
    private string? _premiumProviderName;

    public bool IsConfigured
    {
        get
        {
            _lock.EnterReadLock();
            try { return _isConfigured; }
            finally { _lock.ExitReadLock(); }
        }
    }

    public string? DefaultModelId => _defaultModelId;
    public string? DefaultProviderName => _defaultProviderName;
    public string? PremiumModelId => _premiumModelId;
    public string? PremiumProviderName => _premiumProviderName;

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

        Task.Run(() => ReinitializeClientsAsync(optionsMonitor.CurrentValue)).GetAwaiter().GetResult();

        _changeSubscription = optionsMonitor.OnChange((newSettings, __) =>
        {
            _logger.LogInformation("AI settings changed, reinitializing clients");
            _ = ReinitializeClientsAsync(newSettings).ContinueWith(
                t => _logger.LogWarning(t.Exception, "Failed to reinitialize AI clients"),
                TaskContinuationOptions.OnlyOnFaulted);
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

    private async Task ReinitializeClientsAsync(AiSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.DefaultModel) ||
            string.IsNullOrWhiteSpace(settings.PremiumModel))
        {
            ResetClients();
            _logger.LogWarning("AI not configured — Default or Premium model not set");
            return;
        }

        var resolved = await ResolveProvidersAsync(settings);
        if (resolved is null)
            return;

        var (defaultResolved, premiumResolved) = resolved.Value;
        SwapClients(settings, defaultResolved, premiumResolved);

        _logger.LogInformation(
            "AI clients initialized (default: {Default} via {DefaultProvider}, premium: {Premium} via {PremiumProvider})",
            settings.DefaultModel, defaultResolved.ProviderName,
            settings.PremiumModel, premiumResolved.ProviderName);

        OnReconfigured?.Invoke();
    }

    private async Task<(ResolvedProvider Default, ResolvedProvider Premium)?> ResolveProvidersAsync(AiSettings settings)
    {
        List<AiProvider> providers;
        try
        {
            providers = await LoadProvidersAsync();
        }
        catch (Exception ex)
        {
            ResetClients();
            _logger.LogWarning(ex, "Failed to load AI providers — AI features unavailable");
            return null;
        }

        var defaultResolved = ResolveProviderForModel(providers, settings.DefaultModel, settings.DefaultModelProviderId);
        var premiumResolved = ResolveProviderForModel(providers, settings.PremiumModel, settings.PremiumModelProviderId);

        if (defaultResolved is null || premiumResolved is null)
        {
            ResetClients();
            _logger.LogWarning("AI not configured — no active provider found for {Missing} model",
                defaultResolved is null ? "default" : "premium");
            return null;
        }

        return (defaultResolved, premiumResolved);
    }

    private void SwapClients(AiSettings settings, ResolvedProvider defaultResolved, ResolvedProvider premiumResolved)
    {
        var premiumOpenAiClient = CreateOpenAIClient(premiumResolved.ApiKey, premiumResolved.EndpointUrl);
        var defaultOpenAiClient = premiumResolved == defaultResolved
            ? premiumOpenAiClient
            : CreateOpenAIClient(defaultResolved.ApiKey, defaultResolved.EndpointUrl);

        _lock.EnterWriteLock();
        try
        {
            (_premiumClient as IDisposable)?.Dispose();
            (_defaultClient as IDisposable)?.Dispose();

            _openAiClient = premiumOpenAiClient;

            var premiumBase = premiumOpenAiClient.GetChatClient(settings.PremiumModel).AsIChatClient();
            var defaultBase = defaultOpenAiClient.GetChatClient(settings.DefaultModel).AsIChatClient();

            _premiumClient = ChatOptionsBuilder.WrapWithRoleOverrides(
                ChatOptionsBuilder.WrapWithModelDefaults(premiumBase, premiumResolved.Model),
                settings.PremiumModelTemperature,
                settings.PremiumModelMaxTokens,
                settings.PremiumModelReasoningEffort);
            _defaultClient = ChatOptionsBuilder.WrapWithRoleOverrides(
                ChatOptionsBuilder.WrapWithModelDefaults(defaultBase, defaultResolved.Model),
                settings.DefaultModelTemperature,
                settings.DefaultModelMaxTokens,
                settings.DefaultModelReasoningEffort);
            _isConfigured = true;
            _defaultModelId = settings.DefaultModel;
            _defaultProviderName = defaultResolved.ProviderName;
            _premiumModelId = settings.PremiumModel;
            _premiumProviderName = premiumResolved.ProviderName;
        }
        finally { _lock.ExitWriteLock(); }
    }

    private void ResetClients()
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
            _defaultModelId = null;
            _defaultProviderName = null;
            _premiumModelId = null;
            _premiumProviderName = null;
        }
        finally { _lock.ExitWriteLock(); }
    }

    private async Task<List<AiProvider>> LoadProvidersAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IAiProviderRepository>();
        return await repo.GetAllAsync();
    }

    private record ResolvedProvider(string ApiKey, string? EndpointUrl, string ProviderName, AiProviderModel Model);

    private ResolvedProvider? ResolveProviderForModel(List<AiProvider> providers, string modelId, string? providerId = null)
    {
        var activeProviders = providers.Where(p => p.IsActive);

        // When a provider ID is specified, filter to that provider first
        if (!string.IsNullOrWhiteSpace(providerId) && Guid.TryParse(providerId, out var pid))
            activeProviders = activeProviders.Where(p => p.Id == pid);

        var match = activeProviders
            .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
            .FirstOrDefault(x => x.Model.IsActive &&
                x.Model.ModelId.Equals(modelId, StringComparison.OrdinalIgnoreCase));

        if (match is null || !_encryption.IsAvailable) return null;

        string apiKey;
        try
        {
            apiKey = _encryption.Decrypt(match.Provider.ApiKeyEncrypted);
        }
        catch (Exception)
        {
            return null; // Treat corrupt credentials as unconfigured
        }
        return new ResolvedProvider(apiKey, match.Provider.EndpointUrl, match.Provider.Name, match.Model);
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
