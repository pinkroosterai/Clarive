using System.Diagnostics;
using Clarive.AI.Agents;
using Clarive.AI.Evaluation;
using Clarive.AI.Models;
using Clarive.AI.Orchestration;
using Clarive.AI.Pipeline;
using Clarive.AI.Prompts;
using Clarive.Domain.Entities;
using Clarive.Domain.Enums;
using Clarive.Domain.Errors;
using Clarive.Domain.Interfaces.Repositories;
using Clarive.Domain.Interfaces.Services;
using Clarive.Domain.ValueObjects;
using ErrorOr;
using Microsoft.Extensions.AI;

namespace Clarive.Application.AiGeneration.Services;

public class AiGenerationService(
    IPromptOrchestrator orchestrator,
    IAiSessionRepository sessionRepo,
    IEntryRepository entryRepo,
    IToolRepository toolRepo,
    IAiUsageLogger usageLogger,
    IAgentFactory agentFactory
) : IAiGenerationService
{
    public async Task<AiGenerationResult> GenerateAsync(
        Guid tenantId,
        Guid userId,
        GeneratePromptRequest request,
        CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var config = await BuildGenerationConfig(
            request.Description,
            request.GenerateSystemMessage,
            request.GenerateTemplate,
            request.GenerateChain,
            request.ToolIds,
            request.EnableWebSearch,
            tenantId,
            ct
        );

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.GenerateAsync(config, ct, onProgress);
        sw.Stop();

        await LogAllUsageAsync(
            tenantId, userId, sw.ElapsedMilliseconds,
            result.Usage, result.EvaluationUsage, result.ClarificationUsage, ct
        );

        return await CreateSessionAndBuildResultAsync(tenantId, result, config, ct);
    }

    public async Task<ErrorOr<AiGenerationResult>> RefineAsync(
        Guid tenantId,
        Guid userId,
        RefinePromptRequest request,
        CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var session = await sessionRepo.GetByIdAsync(tenantId, request.SessionId, ct);
        if (session is null)
            return DomainErrors.SessionNotFound;

        if (session.AgentSessionId is null || session.Config is null)
            return Error.Validation(
                "VALIDATION_ERROR",
                "Session does not have an active agent workflow."
            );

        var answers =
            request
                .Answers?.Where(a =>
                    a.QuestionIndex >= 0 && a.QuestionIndex < session.Questions.Count
                )
                .Select(a => new AnsweredQuestion(
                    session.Questions[a.QuestionIndex].Text,
                    a.Answer
                ))
                .ToList()
            ?? [];

        var selectedEnhancements =
            request
                .SelectedEnhancements?.Where(i => i >= 0 && i < session.Enhancements.Count)
                .Select(i => session.Enhancements[i])
                .ToList()
            ?? [];

        var currentEvaluation = session.ScoreHistory.LastOrDefault();
        var evalForRevision = currentEvaluation is not null
            ? new PromptEvaluation { PromptEvaluations = currentEvaluation.Scores }
            : new PromptEvaluation();

        var scoreHistoryAverages = session.ScoreHistory.Select(s => s.AverageScore).ToList();

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.RefineAsync(
            session.AgentSessionId,
            session.Config,
            evalForRevision,
            answers,
            selectedEnhancements,
            scoreHistoryAverages,
            ct,
            onProgress
        );
        sw.Stop();

        await LogAllUsageAsync(
            tenantId, userId, sw.ElapsedMilliseconds,
            result.Usage, result.EvaluationUsage, result.ClarificationUsage, ct
        );

        return await UpdateSessionAndBuildResultAsync(session, request.SessionId, result, ct);
    }

    public async Task<ErrorOr<AiGenerationResult>> EnhanceAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        var prompts = working
            .Prompts.OrderBy(p => p.Order)
            .Select(p => new PromptInput(p.Content, p.IsTemplate))
            .ToList();

        var tenantTools = await toolRepo.GetByTenantAsync(tenantId, ct);
        var toolInfos = tenantTools
            .Select(t => new ToolInfo(t.Name, t.Description))
            .ToList();

        var config = new GenerationConfig
        {
            Description = $"Enhance existing entry: {entry.Title}",
            GenerateSystemMessage = working.SystemMessage is not null,
            GenerateAsPromptTemplate = prompts.Any(p => p.IsTemplate),
            GenerateAsPromptChain = prompts.Count > 1,
            SelectedTools = toolInfos,
        };

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.EnhanceAsync(
            working.SystemMessage,
            prompts,
            config,
            ct,
            onProgress
        );
        sw.Stop();

        await LogAllUsageAsync(
            tenantId, userId, sw.ElapsedMilliseconds,
            result.Usage, result.EvaluationUsage, result.ClarificationUsage, ct, entryId
        );

        return await CreateSessionAndBuildResultAsync(tenantId, result, config, ct);
    }

    public async Task<ErrorOr<string>> GenerateSystemMessageAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        if (!string.IsNullOrEmpty(working.SystemMessage))
            return Error.Conflict("ALREADY_EXISTS", "Entry already has a system message.");

        var promptInputs = working
            .Prompts.OrderBy(p => p.Order)
            .Select(p => new PromptInput(p.Content, p.IsTemplate))
            .ToList();

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.GenerateSystemMessageAsync(promptInputs, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.SystemMessage,
            sw.ElapsedMilliseconds,
            agentResult.Usage,
            entryId,
            ct
        );

        return agentResult.Value;
    }

    public async Task<ErrorOr<List<PromptInput>>> DecomposeAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        if (working.Prompts.Count != 1)
            return Error.Conflict(
                "ALREADY_CHAIN",
                "Entry must have exactly one prompt to decompose."
            );

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.DecomposeAsync(
            working.Prompts[0].Content,
            working.Prompts[0].IsTemplate,
            working.SystemMessage,
            ct
        );
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.Decomposition,
            sw.ElapsedMilliseconds,
            agentResult.Usage,
            entryId,
            ct
        );

        return agentResult.Value;
    }

    public async Task<ErrorOr<Dictionary<string, string>>> FillTemplateFieldsAsync(
        Guid tenantId,
        Guid userId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var workingResult = await GetValidatedWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (workingResult.IsError)
            return workingResult.Errors;

        var (entry, working) = workingResult.Value;

        var prompts = working.Prompts.OrderBy(p => p.Order).ToList();
        var allFields = prompts
            .Where(p => p.IsTemplate)
            .SelectMany(p => p.TemplateFields)
            .DistinctBy(f => f.Name)
            .ToList();

        if (allFields.Count == 0)
            return Error.Validation("NO_TEMPLATE_FIELDS", "Entry has no template fields.");

        var fieldInfos = allFields
            .Select(f => new TemplateFieldInfo(
                f.Name,
                f.Type.ToString().ToLowerInvariant(),
                f.EnumValues,
                f.Min,
                f.Max,
                null
            ))
            .ToList();

        var promptInputs = prompts.Select(p => new PromptInput(p.Content, p.IsTemplate)).ToList();

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.FillTemplateFieldsAsync(
            fieldInfos,
            promptInputs,
            working.SystemMessage,
            ct
        );
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.FillTemplateFields,
            sw.ElapsedMilliseconds,
            agentResult.Usage,
            entryId,
            ct
        );

        return agentResult.Value;
    }

    public async Task<ErrorOr<string>> PolishDescriptionAsync(
        Guid tenantId,
        Guid userId,
        string description,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(description))
            return Error.Validation("VALIDATION_ERROR", "Description is required.");

        if (description.Length > 2000)
            return Error.Validation("VALIDATION_ERROR", "Description must be 2000 characters or fewer.");

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.PolishDescriptionAsync(description, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.PolishDescription,
            sw.ElapsedMilliseconds,
            result.Usage,
            ct
        );

        return result.Value;
    }

    public async Task<ErrorOr<string>> ResolveMergeConflictAsync(
        Guid tenantId,
        Guid userId,
        string fieldName,
        string versionA,
        string versionB,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(fieldName))
            return Error.Validation("VALIDATION_ERROR", "Field name is required.");

        if (string.IsNullOrWhiteSpace(versionA) && string.IsNullOrWhiteSpace(versionB))
            return Error.Validation("VALIDATION_ERROR", "At least one version must have content.");

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.ResolveMergeConflictAsync(fieldName, versionA, versionB, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.SystemMessage,
            sw.ElapsedMilliseconds,
            result.Usage,
            ct
        );

        return result.Value;
    }

    public async Task<ErrorOr<EvaluationDto>> EvaluateAsync(
        Guid tenantId,
        Guid userId,
        EvaluateEntryRequest request,
        CancellationToken ct
    )
    {
        var promptMessages = request.Prompts
            .OrderBy(p => p.SortOrder)
            .Select(p => new PromptMessage { Content = p.Content })
            .ToList();

        var hasTemplateVars = promptMessages.Any(p => p.Content.Contains("{{"));

        var config = new GenerationConfig
        {
            Description = request.Description ?? "Evaluate prompt quality",
            GenerateSystemMessage = request.SystemMessage != null,
            GenerateAsPromptTemplate = hasTemplateVars,
            GenerateAsPromptChain = promptMessages.Count > 1,
        };

        var prompts = new PromptSet
        {
            SystemMessage = request.SystemMessage,
            Prompts = promptMessages,
        };

        var sw = Stopwatch.StartNew();
        var (evaluation, usage) = await orchestrator.EvaluateAsync(config, prompts, ct);
        sw.Stop();

        await LogUsageAsync(
            tenantId,
            userId,
            AiActionType.Evaluation,
            sw.ElapsedMilliseconds,
            usage,
            ct
        );

        var mapped = MapEvaluation(evaluation);
        if (mapped is null)
            return Error.Failure("EVALUATION_FAILED", "Evaluation could not be completed. Please try again.");

        return mapped;
    }

    // ── Private helpers ──

    private Task<AiGenerationResult> CreateSessionAndBuildResultAsync(
        Guid tenantId,
        GenerateOrchestratorResult result,
        GenerationConfig config,
        CancellationToken ct
    ) => CreateSessionAndBuildResultAsync(
        tenantId, result.AgentSessionId, result.Prompts, result.Evaluation, result.Clarification, config, ct
    );

    private Task<AiGenerationResult> CreateSessionAndBuildResultAsync(
        Guid tenantId,
        EnhanceOrchestratorResult result,
        GenerationConfig config,
        CancellationToken ct
    ) => CreateSessionAndBuildResultAsync(
        tenantId, result.AgentSessionId, result.Prompts, result.Evaluation, result.Clarification, config, ct
    );

    private async Task<AiGenerationResult> CreateSessionAndBuildResultAsync(
        Guid tenantId,
        string agentSessionId,
        PromptSet prompts,
        PromptEvaluation? evaluation,
        ClarificationResult? clarification,
        GenerationConfig config,
        CancellationToken ct
    )
    {
        var scoreHistory = BuildInitialScoreHistory(evaluation);
        var draft = MapPromptSetToDraft(prompts);
        var questions = clarification?.Questions ?? [];
        var enhancements = clarification?.Enhancements ?? [];

        var sessionId = Guid.NewGuid();
        await sessionRepo.CreateAsync(
            new AiSession
            {
                Id = sessionId,
                TenantId = tenantId,
                Draft = draft,
                Questions = questions,
                Enhancements = enhancements,
                ScoreHistory = scoreHistory,
                Config = config,
                AgentSessionId = agentSessionId,
                CreatedAt = DateTime.UtcNow,
            },
            ct
        );

        return ToResult(sessionId, draft, questions, enhancements, evaluation, scoreHistory);
    }

    private async Task<AiGenerationResult> UpdateSessionAndBuildResultAsync(
        AiSession session,
        Guid sessionId,
        GenerateOrchestratorResult result,
        CancellationToken ct
    )
    {
        var newScoreHistory = new List<IterationScore>(session.ScoreHistory);
        if (result.Evaluation is not null)
        {
            var avgScore = EvaluationNormalizer.ComputeAverageScore(result.Evaluation);
            newScoreHistory.Add(
                new IterationScore
                {
                    Iteration = newScoreHistory.Count + 1,
                    Scores = result.Evaluation.PromptEvaluations,
                    AverageScore = avgScore,
                }
            );
        }

        var draft = MapPromptSetToDraft(result.Prompts);
        var questions = result.Clarification?.Questions ?? [];
        var enhancements = result.Clarification?.Enhancements ?? [];

        session.Draft = draft;
        session.Questions = questions;
        session.Enhancements = enhancements;
        session.ScoreHistory = newScoreHistory;
        await sessionRepo.UpdateAsync(session, ct);

        return ToResult(sessionId, draft, questions, enhancements, result.Evaluation, newScoreHistory);
    }

    private async Task LogAllUsageAsync(
        Guid tenantId,
        Guid userId,
        long durationMs,
        UsageDetails? generationUsage,
        UsageDetails? evaluationUsage,
        UsageDetails? clarificationUsage,
        CancellationToken ct,
        Guid? entryId = null
    )
    {
        await LogUsageAsync(tenantId, userId, AiActionType.Generation, durationMs, generationUsage, entryId, ct);
        await LogUsageAsync(tenantId, userId, AiActionType.Evaluation, durationMs, evaluationUsage, entryId, ct);
        await LogUsageAsync(tenantId, userId, AiActionType.Clarification, durationMs, clarificationUsage, entryId, ct);
    }

    private async Task<ErrorOr<(PromptEntry Entry, PromptEntryVersion Working)>> GetValidatedWorkingVersionAsync(
        Guid tenantId,
        Guid entryId,
        Guid? tabId,
        CancellationToken ct
    )
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return DomainErrors.EntryNotFound;

        var version = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, tabId, ct);
        if (version is null)
            return DomainErrors.VersionNotFoundForEntry;

        return (entry, version);
    }

    private Task LogUsageAsync(
        Guid tenantId,
        Guid userId,
        AiActionType actionType,
        long durationMs,
        UsageDetails? usage,
        CancellationToken ct
    ) => LogUsageAsync(tenantId, userId, actionType, durationMs, usage, null, ct);

    private Task LogUsageAsync(
        Guid tenantId,
        Guid userId,
        AiActionType actionType,
        long durationMs,
        UsageDetails? usage,
        Guid? entryId,
        CancellationToken ct
    )
    {
        // Skip logging if no usage data (e.g. agent failed and returned null)
        if (usage is null)
            return Task.CompletedTask;

        var (modelId, providerName) = agentFactory.GetModelInfo(actionType);

        return usageLogger.LogAsync(
            tenantId,
            userId,
            actionType,
            modelId ?? "unknown",
            providerName ?? "unknown",
            usage.InputTokenCount ?? 0,
            usage.OutputTokenCount ?? 0,
            durationMs,
            entryId,
            ct
        );
    }

    private async Task<GenerationConfig> BuildGenerationConfig(
        string description,
        bool generateSystemMessage,
        bool generateTemplate,
        bool generateChain,
        List<Guid>? toolIds,
        bool enableWebSearch,
        Guid tenantId,
        CancellationToken ct
    )
    {
        var tools = new List<ToolInfo>();
        if (toolIds is { Count: > 0 })
        {
            var toolEntities = await toolRepo.GetByIdsAsync(tenantId, toolIds, ct);
            tools.AddRange(toolEntities.Select(t => new ToolInfo(t.Name, t.Description)));
        }

        return new GenerationConfig
        {
            Description = description,
            GenerateSystemMessage = generateSystemMessage,
            GenerateAsPromptTemplate = generateTemplate,
            GenerateAsPromptChain = generateChain,
            SelectedTools = tools,
            EnableWebSearch = enableWebSearch,
        };
    }

    private static List<IterationScore> BuildInitialScoreHistory(PromptEvaluation? evaluation)
    {
        if (evaluation is null)
            return [];

        return
        [
            new IterationScore
            {
                Iteration = 1,
                Scores = evaluation.PromptEvaluations,
                AverageScore = EvaluationNormalizer.ComputeAverageScore(evaluation),
            },
        ];
    }

    private static CreateEntryRequest MapPromptSetToDraft(PromptSet prompts) =>
        new(
            prompts.Title,
            prompts.SystemMessage,
            prompts.Prompts.Select(p => new PromptInput(p.Content, p.IsTemplate)).ToList(),
            null
        );

    private static AiGenerationResult ToResult(
        Guid sessionId,
        CreateEntryRequest draft,
        List<ClarificationQuestion> questions,
        List<string> enhancements,
        PromptEvaluation? evaluation,
        List<IterationScore> scoreHistory
    )
    {
        return new AiGenerationResult(
            sessionId,
            draft,
            questions.Select(q => new ClarificationQuestionDto(q.Text, q.Suggestions)).ToList(),
            enhancements,
            MapEvaluation(evaluation),
            MapScoreHistory(scoreHistory)
        );
    }

    private static EvaluationDto? MapEvaluation(PromptEvaluation? evaluation)
    {
        if (evaluation is null)
            return null;
        return new EvaluationDto(
            evaluation.PromptEvaluations.ToDictionary(
                kvp => kvp.Key,
                kvp => new EvaluationEntryDto(kvp.Value.Score, kvp.Value.Feedback)
            )
        );
    }

    private static List<IterationScoreDto> MapScoreHistory(List<IterationScore> history) =>
        history
            .Select(s => new IterationScoreDto(
                s.Iteration,
                s.Scores.ToDictionary(
                    kvp => kvp.Key,
                    kvp => new EvaluationEntryDto(kvp.Value.Score, kvp.Value.Feedback)
                ),
                s.AverageScore
            ))
            .ToList();
}
