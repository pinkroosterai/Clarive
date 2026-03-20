using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Clarive.AI.Services;
using Clarive.Infrastructure.Security;
using System.ClientModel;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.AI.Extensions;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;

namespace Clarive.AI.Agents;

/// <summary>
/// Creates AIAgent instances backed by OpenAI-compatible models.
/// Singleton lifetime — holds per-action OpenAI clients and hot-reloads on config change.
/// Resolves API credentials from AI providers in the database.
/// </summary>
public class OpenAIAgentFactory : IAgentFactory, IDisposable
{
    internal static readonly AiActionType[] ConfigurableActions =
    [
        AiActionType.Generation,
        AiActionType.Evaluation,
        AiActionType.Clarification,
        AiActionType.SystemMessage,
        AiActionType.Decomposition,
        AiActionType.FillTemplateFields,
        AiActionType.PlaygroundJudge,
    ];

    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<OpenAIAgentFactory> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEncryptionService _encryption;
    private readonly ReaderWriterLockSlim _lock = new();
    private readonly IDisposable? _changeSubscription;
    private readonly Dictionary<AiActionType, IChatClient> _actionClients = new();
    private readonly Dictionary<
        AiActionType,
        (string ModelId, string ProviderName)
    > _actionModelInfo = new();

    private OpenAIClient? _openAiClient;
    private bool _isConfigured;

    public bool IsConfigured
    {
        get
        {
            _lock.EnterReadLock();
            try
            {
                return _isConfigured;
            }
            finally
            {
                _lock.ExitReadLock();
            }
        }
    }

    public (string? ModelId, string? ProviderName) GetModelInfo(AiActionType actionType)
    {
        _lock.EnterReadLock();
        try
        {
            return _actionModelInfo.TryGetValue(actionType, out var info) ? info : (null, null);
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public event Action? OnReconfigured;

    public OpenAIAgentFactory(
        IOptionsMonitor<AiSettings> optionsMonitor,
        IServiceScopeFactory scopeFactory,
        IEncryptionService encryption,
        ILoggerFactory loggerFactory
    )
    {
        _loggerFactory = loggerFactory;
        _logger = loggerFactory.CreateLogger<OpenAIAgentFactory>();
        _scopeFactory = scopeFactory;
        _encryption = encryption;

        Task.Run(() => ReinitializeClientsAsync(optionsMonitor.CurrentValue))
            .GetAwaiter()
            .GetResult();

        _changeSubscription = optionsMonitor.OnChange(
            (newSettings, __) =>
            {
                _logger.LogInformation("AI settings changed, reinitializing clients");
                _ = ReinitializeClientsAsync(newSettings)
                    .ContinueWith(
                        t => _logger.LogWarning(t.Exception, "Failed to reinitialize AI clients"),
                        TaskContinuationOptions.OnlyOnFaulted
                    );
            }
        );
    }

    public (AIAgent Agent, ToolProgressReporter? ToolProgress) CreateGenerationAgent(
        GenerationConfig config,
        IList<AITool>? tools = null
    )
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            var client = _actionClients[AiActionType.Generation];

            if (tools is { Count: > 0 })
            {
                var reporter = new ToolProgressReporter();
                var handler = new TavilyToolProgressHandler(reporter);

                var pipeline = new ChatClientBuilder(client)
                    .Use(innerClient =>
                    {
                        var eefic = new EventEmittingFunctionInvokingChatClient(
                            innerClient,
                            _loggerFactory
                        );
                        eefic.ToolCallStarting += handler.OnToolCallStartingAsync;
                        eefic.ToolCallCompleted += handler.OnToolCallCompletedAsync;
                        return eefic;
                    })
                    .Build();

                var agent = pipeline.AsAIAgent(
                    instructions: AgentInstructions.BuildGeneration(config),
                    name: "PromptGenerator",
                    tools: tools,
                    loggerFactory: _loggerFactory
                );

                return (agent, reporter);
            }

            var standardAgent = client.AsAIAgent(
                instructions: AgentInstructions.BuildGeneration(config),
                name: "PromptGenerator",
                loggerFactory: _loggerFactory
            );

            return (standardAgent, null);
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public AIAgent CreateEvaluationAgent(GenerationConfig config) =>
        CreateActionAgent(
            AiActionType.Evaluation,
            AgentInstructions.BuildEvaluation(config),
            "PromptEvaluator"
        );

    public AIAgent CreateClarificationAgent() =>
        CreateActionAgent(
            AiActionType.Clarification,
            AgentInstructions.Clarification,
            "PromptClarifier"
        );

    public AIAgent CreateSystemMessageAgent() =>
        CreateActionAgent(
            AiActionType.SystemMessage,
            AgentInstructions.SystemMessage,
            "SystemMessageGenerator"
        );

    public AIAgent CreateDecomposeAgent() =>
        CreateActionAgent(
            AiActionType.Decomposition,
            AgentInstructions.Decompose,
            "PromptDecomposer"
        );

    public AIAgent CreateFillTemplateFieldsAgent() =>
        CreateActionAgent(
            AiActionType.FillTemplateFields,
            AgentInstructions.FillTemplateFields,
            "TemplateFieldFiller"
        );

    public AIAgent CreatePlaygroundJudgeAgent() =>
        CreateActionAgent(
            AiActionType.PlaygroundJudge,
            AgentInstructions.PlaygroundJudge,
            "PlaygroundJudge"
        );

    private ChatClientAgent CreateActionAgent(
        AiActionType actionType,
        string instructions,
        string name
    )
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _actionClients[actionType]
                .AsAIAgent(instructions: instructions, name: name, loggerFactory: _loggerFactory);
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public static OpenAIClient CreateOpenAIClient(string apiKey, string? endpointUrl)
    {
        if (!string.IsNullOrWhiteSpace(endpointUrl))
        {
            return new OpenAIClient(
                new ApiKeyCredential(apiKey),
                new OpenAIClientOptions { Endpoint = new Uri(endpointUrl) }
            );
        }

        return new OpenAIClient(apiKey);
    }

    private async Task ReinitializeClientsAsync(AiSettings settings)
    {
        // Check all 7 actions have models configured
        foreach (var action in ConfigurableActions)
        {
            var config = settings.GetActionConfig(action);
            if (config is null || string.IsNullOrWhiteSpace(config.Model))
            {
                ResetClients();
                _logger.LogWarning("AI not configured — {Action} model not set", action);
                return;
            }
        }

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

        // Resolve providers for all actions
        var resolvedActions =
            new Dictionary<AiActionType, (ActionAiConfig Config, ResolvedProvider Provider)>();
        foreach (var action in ConfigurableActions)
        {
            var config = settings.GetActionConfig(action)!;
            var resolved = ResolveProviderForModel(providers, config.Model, config.ProviderId);
            if (resolved is null)
            {
                ResetClients();
                _logger.LogWarning(
                    "AI not configured — no active provider found for {Action} model ({Model})",
                    action,
                    config.Model
                );
                return;
            }
            resolvedActions[action] = (config, resolved);
        }

        SwapClients(resolvedActions);

        var genInfo = resolvedActions[AiActionType.Generation];
        _logger.LogInformation(
            "AI clients initialized — {Count} actions configured (generation: {Model} via {Provider})",
            ConfigurableActions.Length,
            genInfo.Config.Model,
            genInfo.Provider.ProviderName
        );

        OnReconfigured?.Invoke();
    }

    private void SwapClients(
        Dictionary<AiActionType, (ActionAiConfig Config, ResolvedProvider Provider)> resolvedActions
    )
    {
        // Group by provider to reuse OpenAIClient instances
        var openAiClients = new Dictionary<string, OpenAIClient>();
        OpenAIClient? firstClient = null;

        foreach (var (_, (config, provider)) in resolvedActions)
        {
            var providerKey = $"{provider.ApiKey}|{provider.EndpointUrl}";
            if (!openAiClients.ContainsKey(providerKey))
            {
                var client = CreateOpenAIClient(provider.ApiKey, provider.EndpointUrl);
                openAiClients[providerKey] = client;
                firstClient ??= client;
            }
        }

        _lock.EnterWriteLock();
        try
        {
            // Dispose old clients
            foreach (var client in _actionClients.Values)
                (client as IDisposable)?.Dispose();

            _actionClients.Clear();
            _actionModelInfo.Clear();

            _openAiClient = firstClient;

            foreach (var (action, (config, provider)) in resolvedActions)
            {
                var providerKey = $"{provider.ApiKey}|{provider.EndpointUrl}";
                var openAiClient = openAiClients[providerKey];

                var baseClient = openAiClient.GetChatClient(config.Model).AsIChatClient();
                var resilientClient = new ResilientChatClient(baseClient, provider.ProviderName, _logger);

                var wrappedClient = ChatOptionsBuilder.WrapWithRoleOverrides(
                    ChatOptionsBuilder.WrapWithModelDefaults(resilientClient, provider.Model),
                    config.Temperature,
                    config.MaxTokens,
                    config.ReasoningEffort
                );

                _actionClients[action] = wrappedClient;
                _actionModelInfo[action] = (config.Model, provider.ProviderName);
            }

            _isConfigured = _actionClients.Count == ConfigurableActions.Length;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    private void ResetClients()
    {
        _lock.EnterWriteLock();
        try
        {
            foreach (var client in _actionClients.Values)
                (client as IDisposable)?.Dispose();

            _actionClients.Clear();
            _actionModelInfo.Clear();
            _openAiClient = null;
            _isConfigured = false;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    private async Task<List<AiProvider>> LoadProvidersAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IAiProviderRepository>();
        return await repo.GetAllAsync();
    }

    internal record ResolvedProvider(
        string ApiKey,
        string? EndpointUrl,
        string ProviderName,
        AiProviderModel Model
    );

    internal ResolvedProvider? ResolveProviderForModel(
        List<AiProvider> providers,
        string modelId,
        string? providerId = null
    )
    {
        var activeProviders = providers.Where(p => p.IsActive);

        // When a provider ID is specified, filter to that provider first
        if (!string.IsNullOrWhiteSpace(providerId) && Guid.TryParse(providerId, out var pid))
            activeProviders = activeProviders.Where(p => p.Id == pid);

        var match = activeProviders
            .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
            .FirstOrDefault(x =>
                x.Model.IsActive
                && x.Model.ModelId.Equals(modelId, StringComparison.OrdinalIgnoreCase)
            );

        if (match is null || !_encryption.IsAvailable)
            return null;

        string apiKey;
        try
        {
            apiKey = _encryption.Decrypt(match.Provider.ApiKeyEncrypted);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to decrypt API key for provider {ProviderName} (model {ModelId}) — treating as unconfigured",
                match.Provider.Name,
                modelId
            );
            return null;
        }
        return new ResolvedProvider(
            apiKey,
            match.Provider.EndpointUrl,
            match.Provider.Name,
            match.Model
        );
    }

    public IChatClient CreateChatClient(string model)
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
#pragma warning disable OPENAI001 // Responses API is experimental
            return new ChatClientBuilder(_openAiClient!.GetResponsesClient().AsIChatClient(model))
                .UseLogging(_loggerFactory)
                .Build();
#pragma warning restore OPENAI001
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    public IChatClient CreateChatClientForProvider(
        string apiKey,
        string? endpointUrl,
        string model,
        AiApiMode apiMode = AiApiMode.ResponsesApi
    )
    {
        var client = CreateOpenAIClient(apiKey, endpointUrl);
        IChatClient baseClient;
        if (apiMode == AiApiMode.ChatCompletions)
        {
            baseClient = client.GetChatClient(model).AsIChatClient();
        }
        else
        {
#pragma warning disable OPENAI001 // Responses API is experimental
            baseClient = client.GetResponsesClient().AsIChatClient(model);
#pragma warning restore OPENAI001
        }
        return new ChatClientBuilder(baseClient).UseLogging(_loggerFactory).Build();
    }

    public OpenAIClient GetOpenAIClient()
    {
        _lock.EnterReadLock();
        try
        {
            EnsureConfigured();
            return _openAiClient!;
        }
        finally
        {
            _lock.ExitReadLock();
        }
    }

    private void EnsureConfigured()
    {
        if (!_isConfigured)
            throw new InvalidOperationException(
                "AI features are not configured. Set a model for each AI action in Super Admin > AI."
            );
    }

    public void Dispose()
    {
        _changeSubscription?.Dispose();
        _lock.EnterWriteLock();
        try
        {
            foreach (var client in _actionClients.Values)
                (client as IDisposable)?.Dispose();
            _actionClients.Clear();
        }
        finally
        {
            _lock.ExitWriteLock();
        }
        _lock.Dispose();
    }
}
