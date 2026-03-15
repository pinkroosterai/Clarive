using System.Text;
using System.Text.Json;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using ErrorOr;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class PlaygroundService(
    IEntryRepository entryRepo,
    IPlaygroundRunRepository runRepo,
    IAiProviderRepository providerRepo,
    IAgentFactory agentFactory,
    IEncryptionService encryption,
    IOptionsMonitor<AiSettings> aiSettings,
    IConfiguration configuration,
    IMemoryCache cache,
    ILogger<PlaygroundService> logger)
{
    private const int MaxRunsPerEntry = 20;
    private const int DefaultHistoryLimit = 10;

    private const string ProvidersCacheKey = "ai_providers_all";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<ErrorOr<TestStreamResult>> TestEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        TestEntryRequest request,
        CancellationToken ct,
        Func<TestStreamChunk, Task>? onChunk = null)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return Error.NotFound("NOT_FOUND", "Entry not found.");

        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return Error.NotFound("NO_VERSION", "Entry has no working version.");

        var prompts = version.Prompts.OrderBy(p => p.Order).ToList();

        // Validate and substitute template fields
        var fields = request.TemplateFields ?? new Dictionary<string, string>();
        var allFields = prompts
            .Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .DistinctBy(f => f.Name)
            .ToList();

        if (allFields.Count > 0)
        {
            // Filter to only defined fields (strip extra keys)
            fields = TemplateFieldValidator.FilterToDefinedFields(allFields, fields);

            var errors = TemplateFieldValidator.ValidateFields(allFields, fields);
            if (errors.Count > 0)
                return Error.Validation("VALIDATION_ERROR",
                    string.Join("; ", errors.Select(e => $"{e.Key}: {e.Value}")));
        }

        // Resolve and validate model
        var settings = aiSettings.CurrentValue;
        var model = !string.IsNullOrWhiteSpace(request.Model)
            ? request.Model
            : settings.DefaultModel;

        var availableModels = await GetAvailableModelsAsync(ct);
        if (!availableModels.IsError &&
            !availableModels.Value.Contains(model, StringComparer.OrdinalIgnoreCase))
        {
            return Error.Validation("INVALID_MODEL", $"Model '{model}' is not available.");
        }

        var responses = new List<TestRunPromptResponse>();
        var reasoningText = new StringBuilder();
        long? totalInputTokens = null;
        long? totalOutputTokens = null;

        try
        {
            // Resolve provider for this model (cached)
            var providers = await cache.GetOrCreateAsync(ProvidersCacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                entry.Size = 1;
                return await providerRepo.GetAllAsync(ct);
            }) ?? [];
            var providerMatch = providers
                .Where(p => p.IsActive)
                .SelectMany(p => p.Models.Select(m => new { Provider = p, Model = m }))
                .FirstOrDefault(x => x.Model.IsActive &&
                    x.Model.ModelId.Equals(model, StringComparison.OrdinalIgnoreCase));

            IChatClient chatClient;
            if (providerMatch is not null && encryption.IsAvailable)
            {
                var apiKey = encryption.Decrypt(providerMatch.Provider.ApiKeyEncrypted);
                chatClient = agentFactory.CreateChatClientForProvider(
                    apiKey, providerMatch.Provider.EndpointUrl, model);
            }
            else
            {
                chatClient = agentFactory.CreateChatClient(model);
            }

            using var client = chatClient;

            // Skip temperature for models that don't support it (e.g. reasoning models)
            var isTemperatureConfigurable = providerMatch?.Model.IsTemperatureConfigurable ?? true;
            var options = new ChatOptions
            {
                ModelId = model,
                Temperature = isTemperatureConfigurable ? request.Temperature : null,
                MaxOutputTokens = request.MaxTokens
            };

            // Configure reasoning if requested
            if (request.ShowReasoning == true)
            {
                var effortStr = request.ReasoningEffort?.ToLowerInvariant();
                var effort = effortStr switch
                {
                    "low" => ReasoningEffort.Low,
                    "high" => ReasoningEffort.High,
                    "extra-high" or "extrahigh" => ReasoningEffort.ExtraHigh,
                    _ => ReasoningEffort.Medium,
                };
                options.Reasoning = new ReasoningOptions
                {
                    Effort = effort,
                    Output = ReasoningOutput.Full,
                };
            }

            var conversationMessages = new List<ChatMessage>();

            // Add system message if present
            var systemMessage = version.SystemMessage;
            if (!string.IsNullOrEmpty(systemMessage))
            {
                systemMessage = allFields.Count > 0
                    ? TemplateParser.Render(systemMessage, fields)
                    : systemMessage;
                conversationMessages.Add(new ChatMessage(ChatRole.System, systemMessage));
            }

            for (var i = 0; i < prompts.Count; i++)
            {
                var prompt = prompts[i];
                var content = allFields.Count > 0 && prompt.IsTemplate
                    ? TemplateParser.Render(prompt.Content, fields)
                    : prompt.Content;

                conversationMessages.Add(new ChatMessage(ChatRole.User, content));

                var responseText = new StringBuilder();
                await foreach (var update in client.GetStreamingResponseAsync(
                    conversationMessages, options, ct))
                {
                    if (update.Text is not null)
                    {
                        responseText.Append(update.Text);
                        if (onChunk is not null)
                            await onChunk(new TestStreamChunk(i, update.Text, "text"));
                    }

                    // Extract reasoning content (TextReasoningContent in Contents)
                    var reasoningContent = update.Contents.OfType<TextReasoningContent>().FirstOrDefault();
                    if (reasoningContent?.Text is not null)
                    {
                        reasoningText.Append(reasoningContent.Text);
                        if (onChunk is not null)
                            await onChunk(new TestStreamChunk(i, reasoningContent.Text, "reasoning"));
                    }

                    // Collect token usage from the final streaming update
                    var usageContent = update.Contents.OfType<UsageContent>().FirstOrDefault();
                    if (usageContent is not null)
                    {
                        totalInputTokens = (totalInputTokens ?? 0) + (usageContent.Details.InputTokenCount ?? 0);
                        totalOutputTokens = (totalOutputTokens ?? 0) + (usageContent.Details.OutputTokenCount ?? 0);
                    }
                }

                var fullResponse = responseText.ToString();
                responses.Add(new TestRunPromptResponse(i, fullResponse));
                conversationMessages.Add(new ChatMessage(ChatRole.Assistant, fullResponse));
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Playground test failed for entry {EntryId}", entryId);
            return Error.Failure("TEST_FAILED", $"LLM request failed: {ex.Message}");
        }

        // Persist the run (store only defined fields)
        var run = new PlaygroundRun
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryId = entryId,
            UserId = userId,
            Model = model,
            Temperature = request.Temperature,
            MaxTokens = request.MaxTokens,
            TemplateFieldValues = fields.Count > 0
                ? JsonSerializer.Serialize(fields, JsonOptions)
                : null,
            Responses = JsonSerializer.Serialize(responses, JsonOptions),
            CreatedAt = DateTime.UtcNow
        };

        await runRepo.AddAsync(run, ct);
        await runRepo.DeleteOldestByEntryIdAsync(entryId, MaxRunsPerEntry, ct);

        var fullReasoning = reasoningText.Length > 0 ? reasoningText.ToString() : null;
        return new TestStreamResult(run.Id, responses, totalInputTokens, totalOutputTokens, fullReasoning);
    }

    public async Task<List<TestRunResponse>> GetTestRunsAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var runs = await runRepo.GetByEntryIdAsync(entryId, DefaultHistoryLimit, ct);

        return runs.Select(r => new TestRunResponse(
            r.Id,
            r.Model,
            r.Temperature,
            r.MaxTokens,
            !string.IsNullOrEmpty(r.TemplateFieldValues)
                ? JsonSerializer.Deserialize<Dictionary<string, string>>(r.TemplateFieldValues, JsonOptions)
                : null,
            JsonSerializer.Deserialize<List<TestRunPromptResponse>>(r.Responses, JsonOptions) ?? [],
            null, null, // Token counts not stored in historical runs
            r.CreatedAt
        )).ToList();
    }

    public async Task<ErrorOr<List<EnrichedModelResponse>>> GetEnrichedModelsAsync(CancellationToken ct)
    {
        const string cacheKey = "playground_enriched_models";

        if (cache.TryGetValue(cacheKey, out List<EnrichedModelResponse>? cached) && cached is not null)
            return cached;

        var providers = await providerRepo.GetAllAsync(ct);
        var activeProviders = providers.Where(p => p.IsActive).ToList();

        if (activeProviders.Count == 0)
        {
            // Fall back to legacy model list (as simple enriched models with no provider metadata)
            var legacyResult = await GetAvailableModelsAsync(ct);
            if (legacyResult.IsError) return legacyResult.Errors;

            var legacyModels = legacyResult.Value.Select(m => new EnrichedModelResponse(
                m, null, Guid.Empty, "Default", false, 128000, true
            )).ToList();

            cache.Set(cacheKey, legacyModels, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                Size = 1
            });
            return legacyModels;
        }

        var enriched = activeProviders
            .SelectMany(p => p.Models
                .Where(m => m.IsActive)
                .Select(m => new EnrichedModelResponse(
                    m.ModelId,
                    m.DisplayName,
                    p.Id,
                    p.Name,
                    m.IsReasoning,
                    m.MaxContextSize,
                    m.IsTemperatureConfigurable
                )))
            .ToList();

        cache.Set(cacheKey, enriched, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
            Size = 1
        });
        return enriched;
    }

    public async Task<ErrorOr<List<string>>> GetAvailableModelsAsync(CancellationToken ct)
    {
        const string cacheKey = "playground_available_models";

        if (cache.TryGetValue(cacheKey, out List<string>? cached) && cached is not null)
            return cached;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var client = agentFactory.GetOpenAIClient();
            var modelClient = client.GetOpenAIModelClient();
            var response = await modelClient.GetModelsAsync(cts.Token);

            var models = response.Value
                .Select(m => m.Id)
                .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Filter to admin-whitelisted models if configured
            var allowedModels = configuration["Ai:AllowedModels"];
            if (!string.IsNullOrWhiteSpace(allowedModels))
            {
                var whitelist = new HashSet<string>(
                    allowedModels.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                    StringComparer.OrdinalIgnoreCase);
                models = models.Where(m => whitelist.Contains(m)).ToList();
            }

            cache.Set(cacheKey, models, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                Size = 1
            });
            return models;
        }
        catch (OperationCanceledException)
        {
            return Error.Failure("TIMEOUT", "Connection timed out fetching models.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch available models");
            return Error.Failure("MODEL_FETCH_FAILED", ex.Message);
        }
    }
}
