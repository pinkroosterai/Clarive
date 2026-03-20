using Clarive.Domain.Interfaces.Services;
using Clarive.AI.Models;
using Clarive.AI.Agents;
using Clarive.AI.Pipeline;
using Clarive.AI.Prompts;
using Clarive.AI.Evaluation;
using Clarive.AI.Configuration;
using Clarive.Application.McpServers.Contracts;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Clarive.Domain.Errors;
using Clarive.Domain.ValueObjects;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Interfaces.Repositories;
using ErrorOr;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;

namespace Clarive.Application.Playground.Services;

public class PlaygroundService(
    IEntryRepository entryRepo,
    IModelResolutionService modelResolution,
    IPlaygroundRunService runService,
    IAgentFactory agentFactory,
    IAiUsageLogger usageLogger,
    IMcpToolProvider mcpToolProvider,
    IOptionsMonitor<AiSettings> aiSettings,
    ILoggerFactory loggerFactory,
    ILogger<PlaygroundService> logger
) : IPlaygroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<ErrorOr<TestStreamResult>> TestEntryAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        TestEntryRequest request,
        CancellationToken ct,
        Func<TestStreamChunk, Task>? onChunk = null,
        Func<ProgressEvent, Task>? onProgress = null
    )
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
                return Error.Validation(
                    "VALIDATION_ERROR",
                    string.Join("; ", errors.Select(e => $"{e.Key}: {e.Value}"))
                );
        }

        // Resolve model
        var settings = aiSettings.CurrentValue;
        var model = !string.IsNullOrWhiteSpace(request.Model)
            ? request.Model
            : settings.Generation.Model;

        var resolvedResult = await modelResolution.ResolveProviderForModelAsync(model, ct);
        if (resolvedResult.IsError)
            return resolvedResult.Errors;

        var resolved = resolvedResult.Value;

        // ── Conversation log builder ──
        var logBuilder = new ConversationLogBuilder();
        long? totalInputTokens = null;
        long? totalOutputTokens = null;

        var sw = Stopwatch.StartNew();
        try
        {
            using var client = resolved.ChatClient;

            // Fetch MCP tools if servers specified
            IList<AITool>? mcpTools = null;
            IChatClient effectiveClient = client;

            if (request.McpServerIds is { Count: > 0 })
            {
                mcpTools = await mcpToolProvider.GetToolsAsync(
                    tenantId, request.McpServerIds, request.ExcludedToolNames, ct);

                if (mcpTools.Count > 0)
                {
                    var reporter = new ToolProgressReporter();
                    var toolHandler = new McpToolProgressHandler(reporter);

                    var wrappedClient = new ChatClientBuilder(client)
                        .Use(inner =>
                        {
                            var eefic = new EventEmittingFunctionInvokingChatClient(inner, loggerFactory);
                            eefic.ToolCallStarting += toolHandler.OnToolCallStartingAsync;
                            eefic.ToolCallCompleted += toolHandler.OnToolCallCompletedAsync;
                            // Also wire to conversation log builder
                            eefic.ToolCallStarting += logBuilder.OnToolCallStartingAsync;
                            eefic.ToolCallCompleted += logBuilder.OnToolCallCompletedAsync;
                            return eefic;
                        })
                        .Build();
                    effectiveClient = wrappedClient;

                    // Wire tool progress events directly to onProgress
                    reporter.OnProgress = onProgress;
                }
            }

            var options = new ChatOptions
            {
                ModelId = model,
                Temperature = resolved.IsTemperatureConfigurable ? request.Temperature : null,
                MaxOutputTokens = request.MaxTokens,
                Tools = mcpTools is { Count: > 0 } ? mcpTools.ToList() : null,
            };

            if (
                request.ShowReasoning == true
                && resolved.ApiMode == AiApiMode.ResponsesApi
            )
            {
                options.Reasoning = new ReasoningOptions
                {
                    Effort = ChatOptionsBuilder.ParseReasoningEffort(
                        request.ReasoningEffort ?? "medium"
                    ),
                    Output = ReasoningOutput.Full,
                };
            }

            var thinkParser =
                resolved.ApiMode == AiApiMode.ChatCompletions
                    ? new ThinkTagStreamParser()
                    : null;

            var conversationMessages = new List<ChatMessage>();

            // System message
            var systemMessage = version.SystemMessage;
            if (!string.IsNullOrEmpty(systemMessage))
            {
                var rendered = allFields.Count > 0
                    ? TemplateParser.Render(systemMessage, fields)
                    : systemMessage;
                conversationMessages.Add(new ChatMessage(ChatRole.System, rendered));
                logBuilder.AddSystemMessage(rendered);
            }

            // Prompt chain loop
            for (var i = 0; i < prompts.Count; i++)
            {
                var prompt = prompts[i];
                var content =
                    allFields.Count > 0 && prompt.IsTemplate
                        ? TemplateParser.Render(prompt.Content, fields)
                        : prompt.Content;

                conversationMessages.Add(new ChatMessage(ChatRole.User, content));
                logBuilder.AddUserMessage(content, i);

                var responseText = new StringBuilder();
                var reasoningText = new StringBuilder();

                await foreach (
                    var update in effectiveClient.GetStreamingResponseAsync(
                        conversationMessages,
                        options,
                        ct
                    )
                )
                {
                    if (thinkParser is not null && update.Text is not null)
                    {
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
                        responseText.Append(update.Text);
                        if (onChunk is not null)
                            await onChunk(new TestStreamChunk(i, update.Text, "text"));
                    }

                    if (thinkParser is null)
                    {
                        var reasoningContent = update
                            .Contents.OfType<TextReasoningContent>()
                            .FirstOrDefault();
                        if (reasoningContent?.Text is not null)
                        {
                            reasoningText.Append(reasoningContent.Text);
                            if (onChunk is not null)
                                await onChunk(
                                    new TestStreamChunk(i, reasoningContent.Text, "reasoning")
                                );
                        }
                    }

                    var usageContent = update.Contents.OfType<UsageContent>().FirstOrDefault();
                    if (usageContent is not null)
                    {
                        totalInputTokens =
                            (totalInputTokens ?? 0) + (usageContent.Details.InputTokenCount ?? 0);
                        totalOutputTokens =
                            (totalOutputTokens ?? 0) + (usageContent.Details.OutputTokenCount ?? 0);
                    }
                }

                // Flush think tag parser
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
                var fullReasoning = reasoningText.Length > 0 ? reasoningText.ToString() : null;

                logBuilder.AddAssistantMessage(fullResponse, fullReasoning, i);
                conversationMessages.Add(new ChatMessage(ChatRole.Assistant, fullResponse));
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Playground test failed for entry {EntryId}", entryId);
            return Error.Failure("TEST_FAILED", $"LLM request failed: {ex.Message}");
        }

        // Persist the run
        var versionLabel =
            version.VersionState == VersionState.Draft ? "Draft" : $"v{version.Version}";

        var run = new PlaygroundRun
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntryId = entryId,
            UserId = userId,
            Model = model,
            Temperature = request.Temperature,
            MaxTokens = request.MaxTokens,
            TemplateFieldValues =
                fields.Count > 0 ? JsonSerializer.Serialize(fields, JsonOptions) : null,
            ConversationLog = JsonSerializer.Serialize(logBuilder.Messages, JsonOptions),
            VersionNumber = version.Version,
            VersionLabel = versionLabel,
            CreatedAt = DateTime.UtcNow,
        };

        await runService.SaveRunAsync(run, ct);
        sw.Stop();

        await usageLogger.LogAsync(
            tenantId,
            userId,
            AiActionType.PlaygroundTest,
            model,
            resolved.ProviderName,
            totalInputTokens ?? 0,
            totalOutputTokens ?? 0,
            sw.ElapsedMilliseconds,
            entryId,
            ct
        );

        return new TestStreamResult(
            run.Id,
            logBuilder.Messages.ToList(),
            totalInputTokens,
            totalOutputTokens,
            VersionNumber: version.Version,
            VersionLabel: versionLabel
        );
    }

    public async Task<ErrorOr<OutputEvaluation>> JudgePlaygroundRunAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid runId,
        CancellationToken ct
    )
    {
        var run = await runService.GetByIdAsync(runId, ct);
        if (run is null || run.TenantId != tenantId || run.EntryId != entryId)
            return Error.NotFound("RUN_NOT_FOUND", "Playground run not found.");

        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (version is null)
            return DomainErrors.NoWorkingVersion;

        var prompts = version.Prompts.OrderBy(p => p.Order).ToList();
        var promptInputs = prompts.Select(p => new PromptInput(p.Content, p.IsTemplate)).ToList();

        // Extract responses from conversation log for judge
        List<TestRunPromptResponse> responses;
        try
        {
            var messages = !string.IsNullOrEmpty(run.ConversationLog)
                ? JsonSerializer.Deserialize<List<ConversationMessage>>(run.ConversationLog, JsonOptions) ?? []
                : [];
            responses = messages
                .Where(m => m.Role == "assistant")
                .Select(m => new TestRunPromptResponse(m.PromptIndex ?? 0, m.Content))
                .ToList();
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Failed to deserialize conversation log for run {RunId}", runId);
            return Error.Failure(
                "INVALID_RUN_DATA",
                "Run data is corrupted. Please re-run the test."
            );
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var agent = agentFactory.CreateAgent(
                AiActionType.PlaygroundJudge, AgentInstructions.PlaygroundJudge, "PlaygroundJudge");
            var task = TaskBuilder.BuildPlaygroundJudgeTask(
                version.SystemMessage,
                promptInputs,
                responses,
                run.Model
            );

            var response = await agent.RunAsync<OutputEvaluation>(task, cancellationToken: ct);
            var evaluation = OutputEvaluationNormalizer.Normalize(response.Result);
            sw.Stop();

            run.JudgeScores = JsonSerializer.Serialize(evaluation, JsonOptions);
            await runService.UpdateRunAsync(run, ct);

            var inputTokens = response.Usage?.InputTokenCount ?? 0;
            var outputTokens = response.Usage?.OutputTokenCount ?? 0;
            var (modelId, providerName) = agentFactory.GetModelInfo(AiActionType.PlaygroundJudge);

            await usageLogger.LogAsync(
                tenantId,
                userId,
                AiActionType.PlaygroundJudge,
                modelId ?? "unknown",
                providerName ?? "unknown",
                inputTokens,
                outputTokens,
                sw.ElapsedMilliseconds,
                entryId,
                ct
            );

            return evaluation;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Playground judge failed for run {RunId}", runId);
            return Error.Failure("JUDGE_FAILED", $"LLM judge evaluation failed: {ex.Message}");
        }
    }
}
