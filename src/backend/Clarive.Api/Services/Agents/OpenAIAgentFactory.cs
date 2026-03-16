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

        // Load providers asynchronously OUTSIDE the lock to avoid deadlocks
        List<AiProvider> providers;
        try
        {
            providers = await LoadProvidersAsync();
        }
        catch (Exception ex)
        {
            ResetClients();
            _logger.LogWarning(ex, "Failed to load AI providers — AI features unavailable");
            return;
        }

        var defaultResolved = ResolveProviderForModel(providers, settings.DefaultModel, settings.DefaultModelProviderId);
        var premiumResolved = ResolveProviderForModel(providers, settings.PremiumModel, settings.PremiumModelProviderId);

        if (defaultResolved is null || premiumResolved is null)
        {
            ResetClients();
            _logger.LogWarning("AI not configured — no active provider found for {Missing} model",
                defaultResolved is null ? "default" : "premium");
            return;
        }

        var premiumOpenAiClient = CreateOpenAIClient(premiumResolved.ApiKey, premiumResolved.EndpointUrl);
        var defaultOpenAiClient = premiumResolved == defaultResolved
            ? premiumOpenAiClient
            : CreateOpenAIClient(defaultResolved.ApiKey, defaultResolved.EndpointUrl);

        // Only hold the write lock for the fast field swap
        _lock.EnterWriteLock();
        try
        {
            (_premiumClient as IDisposable)?.Dispose();
            (_defaultClient as IDisposable)?.Dispose();

            _openAiClient = premiumOpenAiClient;

            var premiumBase = premiumOpenAiClient.GetChatClient(settings.PremiumModel).AsIChatClient();
            var defaultBase = defaultOpenAiClient.GetChatClient(settings.DefaultModel).AsIChatClient();

            // Wrap clients with ConfigureOptions to apply model-specific defaults + role overrides
            _premiumClient = WrapWithRoleOverrides(
                WrapWithModelDefaults(premiumBase, premiumResolved.Model),
                settings.PremiumModelTemperature,
                settings.PremiumModelMaxTokens,
                settings.PremiumModelReasoningEffort);
            _defaultClient = WrapWithRoleOverrides(
                WrapWithModelDefaults(defaultBase, defaultResolved.Model),
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

        _logger.LogInformation(
            "AI clients initialized (default: {Default} via {DefaultProvider}, premium: {Premium} via {PremiumProvider})",
            settings.DefaultModel, defaultResolved.ProviderName,
            settings.PremiumModel, premiumResolved.ProviderName);

        OnReconfigured?.Invoke();
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

    private static IChatClient WrapWithModelDefaults(IChatClient client, AiProviderModel? model)
    {
        var defaults = BuildChatOptions(model);
        if (defaults is null)
            return client;

        return new ChatClientBuilder(client)
            .ConfigureOptions(options =>
            {
                options.Temperature ??= defaults.Temperature;
                options.MaxOutputTokens ??= defaults.MaxOutputTokens;
                options.Reasoning ??= defaults.Reasoning;
            })
            .Build();
    }

    internal static IChatClient WrapWithRoleOverrides(
        IChatClient client, float? temperature, int? maxTokens, string? reasoningEffort)
    {
        if (temperature is null && maxTokens is null && string.IsNullOrWhiteSpace(reasoningEffort))
            return client;

        return new ChatClientBuilder(client)
            .ConfigureOptions(options =>
            {
                // Role overrides replace (not fallback) — they take priority over model defaults
                if (temperature.HasValue)
                    options.Temperature = temperature.Value;
                if (maxTokens.HasValue)
                    options.MaxOutputTokens = maxTokens.Value;
                if (!string.IsNullOrWhiteSpace(reasoningEffort))
                    options.Reasoning = new ReasoningOptions
                    {
                        Effort = ParseReasoningEffort(reasoningEffort)
                    };
            })
            .Build();
    }

    internal static ChatOptions? BuildChatOptions(AiProviderModel? model)
    {
        if (model is null)
            return null;

        var hasTemp = !model.IsReasoning && model.DefaultTemperature.HasValue;
        var hasTokens = model.DefaultMaxTokens.HasValue;
        var hasReasoning = model.IsReasoning && !string.IsNullOrWhiteSpace(model.DefaultReasoningEffort);

        if (!hasTemp && !hasTokens && !hasReasoning)
            return null;

        var options = new ChatOptions();

        if (hasTemp)
            options.Temperature = model.DefaultTemperature!.Value;

        if (hasTokens)
            options.MaxOutputTokens = model.DefaultMaxTokens!.Value;

        if (hasReasoning)
        {
            options.Reasoning = new ReasoningOptions
            {
                Effort = ParseReasoningEffort(model.DefaultReasoningEffort!)
            };
        }

        return options;
    }

    internal static ReasoningEffort ParseReasoningEffort(string effort) =>
        effort.ToLowerInvariant() switch
        {
            "low" => ReasoningEffort.Low,
            "high" => ReasoningEffort.High,
            "extra-high" or "extrahigh" => ReasoningEffort.ExtraHigh,
            _ => ReasoningEffort.Medium,
        };

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
