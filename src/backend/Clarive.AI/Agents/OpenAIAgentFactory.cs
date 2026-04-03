using Microsoft.Extensions.Logging;
using Clarive.AI.Configuration;
using System.ClientModel;
using System.ClientModel.Primitives;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.AI.Pipeline;
using Clarive.AI.Prompts;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;

namespace Clarive.AI.Agents;

/// <summary>
/// Creates AIAgent instances backed by OpenAI-compatible models.
/// Singleton lifetime — holds per-action OpenAI clients and hot-reloads on config change.
/// Delegates provider resolution and credential decryption to IAiProviderResolver.
/// </summary>
public class OpenAIAgentFactory : IAgentFactory, IDisposable
{
    internal static readonly AiActionType[] ConfigurableActions =
        Enum.GetValues<AiActionType>()
            .Where(a => a != AiActionType.PlaygroundTest)
            .ToArray();

    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<OpenAIAgentFactory> _logger;
    private readonly IAiProviderResolver _providerResolver;
    private readonly ReaderWriterLockSlim _lock = new();
    private readonly IDisposable? _changeSubscription;
    private readonly Dictionary<AiActionType, IChatClient> _actionClients = new();
    private readonly Dictionary<
        AiActionType,
        (string ModelId, string ProviderName)
    > _actionModelInfo = new();
    private readonly List<HttpClient> _managedHttpClients = new();

    private OpenAIClient? _openAiClient;
    private bool _isConfigured;

    public bool IsConfigured => WithReadLock(() => _isConfigured);

    public (string? ModelId, string? ProviderName) GetModelInfo(AiActionType actionType) =>
        WithReadLock(() => _actionModelInfo.TryGetValue(actionType, out var info) ? info : (null, null));

    public event Action? OnReconfigured;

    public OpenAIAgentFactory(
        IOptionsMonitor<AiSettings> optionsMonitor,
        IAiProviderResolver providerResolver,
        ILoggerFactory loggerFactory
    )
    {
        _loggerFactory = loggerFactory;
        _logger = loggerFactory.CreateLogger<OpenAIAgentFactory>();
        _providerResolver = providerResolver;

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
    ) => WithReadLock(() =>
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

        return (standardAgent, (ToolProgressReporter?)null);
    });

    public IChatClient GetActionChatClient(AiActionType actionType) =>
        WithReadLock(() => { EnsureConfigured(); return _actionClients[actionType]; });

    public AIAgent CreateAgent(
        AiActionType actionType,
        string instructions,
        string name
    ) => WithReadLock(() =>
    {
        EnsureConfigured();
        return _actionClients[actionType]
            .AsAIAgent(instructions: instructions, name: name, loggerFactory: _loggerFactory);
    });

    public static OpenAIClient CreateOpenAIClient(
        string apiKey,
        string? endpointUrl,
        Dictionary<string, string>? customHeaders = null
    )
    {
        var hasHeaders = customHeaders is { Count: > 0 };

        if (!string.IsNullOrWhiteSpace(endpointUrl))
        {
            var options = new OpenAIClientOptions { Endpoint = new Uri(endpointUrl) };
            if (hasHeaders)
            {
                var handler = new CustomHeadersHandler(customHeaders!);
                var httpClient = new HttpClient(handler);
                options.Transport = new HttpClientPipelineTransport(httpClient);
            }
            return new OpenAIClient(new ApiKeyCredential(apiKey), options);
        }

        if (hasHeaders)
        {
            var options = new OpenAIClientOptions();
            var handler = new CustomHeadersHandler(customHeaders!);
            var httpClient = new HttpClient(handler);
            options.Transport = new HttpClientPipelineTransport(httpClient);
            return new OpenAIClient(new ApiKeyCredential(apiKey), options);
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
            providers = await _providerResolver.LoadProvidersAsync();
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
            var resolved = _providerResolver.ResolveProviderForModel(providers, config.Model, config.ProviderId);
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
        // Pre-compute provider keys to avoid duplicate hash computation
        var actionKeys = new Dictionary<AiActionType, string>();
        foreach (var (action, (_, provider)) in resolvedActions)
            actionKeys[action] = GetProviderKey(provider);

        // Group by provider to reuse OpenAIClient instances
        var openAiClients = new Dictionary<string, OpenAIClient>();
        var newHttpClients = new List<HttpClient>();
        OpenAIClient? firstClient = null;

        foreach (var (action, (_, provider)) in resolvedActions)
        {
            var providerKey = actionKeys[action];
            if (!openAiClients.ContainsKey(providerKey))
            {
                var (client, httpClient) = CreateOpenAIClientWithTracking(
                    provider.ApiKey,
                    provider.EndpointUrl,
                    provider.CustomHeaders
                );
                openAiClients[providerKey] = client;
                if (httpClient is not null)
                    newHttpClients.Add(httpClient);
                firstClient ??= client;
            }
        }

        WithWriteLock(() =>
        {
            // Dispose old chat clients and managed HttpClients
            foreach (var client in _actionClients.Values)
                (client as IDisposable)?.Dispose();
            foreach (var httpClient in _managedHttpClients)
                httpClient.Dispose();
            _managedHttpClients.Clear();

            _actionClients.Clear();
            _actionModelInfo.Clear();

            _openAiClient = firstClient;
            _managedHttpClients.AddRange(newHttpClients);

            foreach (var (action, (config, provider)) in resolvedActions)
            {
                var providerKey = actionKeys[action];
                var openAiClient = openAiClients[providerKey];

                IChatClient baseClient;
                if (provider.ApiMode == AiApiMode.ResponsesApi)
                {
#pragma warning disable OPENAI001 // Responses API is experimental
                    baseClient = openAiClient.GetResponsesClient().AsIChatClient(config.Model);
#pragma warning restore OPENAI001
                }
                else
                {
                    baseClient = openAiClient.GetChatClient(config.Model).AsIChatClient();
                }

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
        });
    }

    private static string GetProviderKey(ResolvedProvider provider)
    {
        var headersHash = provider.CustomHeaders is { Count: > 0 }
            ? string.Join(
                ",",
                provider.CustomHeaders
                    .OrderBy(h => h.Key)
                    .Select(h => $"{h.Key}={h.Value}")
            )
            : "";
        return $"{provider.ApiKey}|{provider.EndpointUrl}|{headersHash}";
    }

    private static (OpenAIClient Client, HttpClient? ManagedHttpClient) CreateOpenAIClientWithTracking(
        string apiKey,
        string? endpointUrl,
        Dictionary<string, string>? customHeaders
    )
    {
        var hasHeaders = customHeaders is { Count: > 0 };

        if (!string.IsNullOrWhiteSpace(endpointUrl))
        {
            var options = new OpenAIClientOptions { Endpoint = new Uri(endpointUrl) };
            if (hasHeaders)
            {
                var handler = new CustomHeadersHandler(customHeaders!);
                var httpClient = new HttpClient(handler);
                options.Transport = new HttpClientPipelineTransport(httpClient);
                return (new OpenAIClient(new ApiKeyCredential(apiKey), options), httpClient);
            }
            return (new OpenAIClient(new ApiKeyCredential(apiKey), options), null);
        }

        if (hasHeaders)
        {
            var options = new OpenAIClientOptions();
            var handler = new CustomHeadersHandler(customHeaders!);
            var httpClient = new HttpClient(handler);
            options.Transport = new HttpClientPipelineTransport(httpClient);
            return (new OpenAIClient(new ApiKeyCredential(apiKey), options), httpClient);
        }

        return (new OpenAIClient(apiKey), null);
    }

    private void ResetClients() => WithWriteLock(() =>
    {
        foreach (var client in _actionClients.Values)
            (client as IDisposable)?.Dispose();
        foreach (var httpClient in _managedHttpClients)
            httpClient.Dispose();
        _managedHttpClients.Clear();

        _actionClients.Clear();
        _actionModelInfo.Clear();
        _openAiClient = null;
        _isConfigured = false;
    });

    public IChatClient CreateChatClient(string model) => WithReadLock(() =>
    {
        EnsureConfigured();
#pragma warning disable OPENAI001 // Responses API is experimental
        return new ChatClientBuilder(_openAiClient!.GetResponsesClient().AsIChatClient(model))
            .UseLogging(_loggerFactory)
            .Build();
#pragma warning restore OPENAI001
    });

    public IChatClient CreateChatClientForProvider(
        string apiKey,
        string? endpointUrl,
        string model,
        AiApiMode apiMode = AiApiMode.ResponsesApi,
        Dictionary<string, string>? customHeaders = null
    )
    {
        var client = CreateOpenAIClient(apiKey, endpointUrl, customHeaders);
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

    public OpenAIClient GetOpenAIClient() =>
        WithReadLock(() => { EnsureConfigured(); return _openAiClient!; });

    private T WithReadLock<T>(Func<T> action)
    {
        _lock.EnterReadLock();
        try { return action(); }
        finally { _lock.ExitReadLock(); }
    }

    private void WithWriteLock(Action action)
    {
        _lock.EnterWriteLock();
        try { action(); }
        finally { _lock.ExitWriteLock(); }
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
        WithWriteLock(() =>
        {
            foreach (var client in _actionClients.Values)
                (client as IDisposable)?.Dispose();
            foreach (var httpClient in _managedHttpClients)
                httpClient.Dispose();
            _managedHttpClients.Clear();
            _actionClients.Clear();
        });
        _lock.Dispose();
    }
}
