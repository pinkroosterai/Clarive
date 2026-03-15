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
    IAgentFactory agentFactory,
    IOptionsMonitor<AiSettings> aiSettings,
    IMemoryCache cache,
    ILogger<PlaygroundService> logger)
{
    private const int MaxRunsPerEntry = 20;
    private const int DefaultHistoryLimit = 10;

    private static readonly string[] OpenAiChatPrefixes = ["gpt-", "o1-", "o3-", "o4-", "chatgpt-"];
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

        try
        {
            using var chatClient = agentFactory.CreateChatClient(model);

            var options = new ChatOptions
            {
                Temperature = request.Temperature,
                MaxOutputTokens = request.MaxTokens
            };

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
                await foreach (var update in chatClient.GetStreamingResponseAsync(
                    conversationMessages, options, ct))
                {
                    if (update.Text is not null)
                    {
                        responseText.Append(update.Text);
                        if (onChunk is not null)
                            await onChunk(new TestStreamChunk(i, update.Text));
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

        return new TestStreamResult(run.Id, responses);
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
            r.CreatedAt
        )).ToList();
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

            var settings = aiSettings.CurrentValue;
            var isOpenAi = string.IsNullOrWhiteSpace(settings.EndpointUrl)
                || settings.EndpointUrl.Contains("api.openai.com", StringComparison.OrdinalIgnoreCase);

            var models = response.Value
                .Select(m => m.Id)
                .Where(id =>
                {
                    if (!isOpenAi) return true;
                    return OpenAiChatPrefixes.Any(prefix =>
                        id.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
                })
                .OrderBy(id => id, StringComparer.OrdinalIgnoreCase)
                .ToList();

            cache.Set(cacheKey, models, TimeSpan.FromMinutes(5));
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
