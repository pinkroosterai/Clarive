using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Clarive.Api.Helpers;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;

namespace Clarive.Api.Services;

public class PlaygroundService(
    IEntryRepository entryRepo,
    IModelResolutionService modelResolution,
    IPlaygroundRunService runService,
    IAiUsageLogger usageLogger,
    IOptionsMonitor<AiSettings> aiSettings,
    ILogger<PlaygroundService> logger) : IPlaygroundService
{
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
            return DomainErrors.EntryNotFound;

        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return DomainErrors.NoWorkingVersion;

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
            fields = TemplateFieldValidator.FilterToDefinedFields(allFields, fields);

            var errors = TemplateFieldValidator.ValidateFields(allFields, fields);
            if (errors.Count > 0)
                return Error.Validation("VALIDATION_ERROR",
                    string.Join("; ", errors.Select(e => $"{e.Key}: {e.Value}")));
        }

        // Resolve model
        var settings = aiSettings.CurrentValue;
        var model = !string.IsNullOrWhiteSpace(request.Model)
            ? request.Model
            : settings.DefaultModel;

        var resolvedResult = await modelResolution.ResolveProviderForModelAsync(model, ct);
        if (resolvedResult.IsError)
            return resolvedResult.Errors;

        var resolved = resolvedResult.Value;

        var responses = new List<TestRunPromptResponse>();
        var reasoningText = new StringBuilder();
        long? totalInputTokens = null;
        long? totalOutputTokens = null;

        var sw = Stopwatch.StartNew();
        try
        {
            using var client = resolved.ChatClient;

            var options = new ChatOptions
            {
                ModelId = model,
                Temperature = resolved.IsTemperatureConfigurable ? request.Temperature : null,
                MaxOutputTokens = request.MaxTokens
            };

            if (request.ShowReasoning == true && resolved.ApiMode == Models.Enums.AiApiMode.ResponsesApi)
            {
                options.Reasoning = new ReasoningOptions
                {
                    Effort = ChatOptionsBuilder.ParseReasoningEffort(request.ReasoningEffort ?? "medium"),
                    Output = ReasoningOutput.Full,
                };
            }

            var thinkParser = resolved.ApiMode == Models.Enums.AiApiMode.ChatCompletions
                ? new Helpers.ThinkTagStreamParser()
                : null;

            var conversationMessages = new List<ChatMessage>();

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
                    if (thinkParser is not null && update.Text is not null)
                    {
                        // Chat Completions mode: parse <think> tags from text
                        foreach (var (segText, isThinking) in thinkParser.ProcessChunk(update.Text))
                        {
                            if (isThinking)
                            {
                                reasoningText.Append(segText);
                                if (onChunk is not null)
                                    await onChunk(new TestStreamChunk(i, segText, "reasoning"));
                            }
                            else
                            {
                                responseText.Append(segText);
                                if (onChunk is not null)
                                    await onChunk(new TestStreamChunk(i, segText, "text"));
                            }
                        }
                    }
                    else if (update.Text is not null)
                    {
                        // Responses API mode: text is always regular content
                        responseText.Append(update.Text);
                        if (onChunk is not null)
                            await onChunk(new TestStreamChunk(i, update.Text, "text"));
                    }

                    // Responses API reasoning content (not available in Chat Completions)
                    if (thinkParser is null)
                    {
                        var reasoningContent = update.Contents.OfType<TextReasoningContent>().FirstOrDefault();
                        if (reasoningContent?.Text is not null)
                        {
                            reasoningText.Append(reasoningContent.Text);
                            if (onChunk is not null)
                                await onChunk(new TestStreamChunk(i, reasoningContent.Text, "reasoning"));
                        }
                    }

                    var usageContent = update.Contents.OfType<UsageContent>().FirstOrDefault();
                    if (usageContent is not null)
                    {
                        totalInputTokens = (totalInputTokens ?? 0) + (usageContent.Details.InputTokenCount ?? 0);
                        totalOutputTokens = (totalOutputTokens ?? 0) + (usageContent.Details.OutputTokenCount ?? 0);
                    }
                }

                // Flush any remaining buffered content from think tag parser
                if (thinkParser is not null)
                {
                    foreach (var (segText, isThinking) in thinkParser.Flush())
                    {
                        if (isThinking)
                        {
                            reasoningText.Append(segText);
                            if (onChunk is not null)
                                await onChunk(new TestStreamChunk(i, segText, "reasoning"));
                        }
                        else
                        {
                            responseText.Append(segText);
                            if (onChunk is not null)
                                await onChunk(new TestStreamChunk(i, segText, "text"));
                        }
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

        // Persist the run
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

        await runService.SaveRunAsync(run, ct);
        sw.Stop();

        await usageLogger.LogAsync(
            tenantId, userId, AiActionType.PlaygroundTest,
            model, resolved.ProviderName,
            totalInputTokens ?? 0, totalOutputTokens ?? 0,
            sw.ElapsedMilliseconds, entryId, ct);

        var fullReasoning = reasoningText.Length > 0 ? reasoningText.ToString() : null;
        return new TestStreamResult(run.Id, responses, totalInputTokens, totalOutputTokens, fullReasoning);
    }
}
