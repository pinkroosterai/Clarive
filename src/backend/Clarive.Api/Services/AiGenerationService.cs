using System.Diagnostics;
using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Enums;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Models.Results;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Agents.AiExtensions;
using Clarive.Api.Services.Interfaces;
using ErrorOr;
using Microsoft.Extensions.AI;

namespace Clarive.Api.Services;

public class AiGenerationService(
    IPromptOrchestrator orchestrator,
    IAiSessionRepository sessionRepo,
    IEntryRepository entryRepo,
    IToolRepository toolRepo,
    IAiUsageLogger usageLogger,
    IAgentFactory agentFactory) : IAiGenerationService
{
    public async Task<AiGenerationResult> GenerateAsync(
        Guid tenantId, Guid userId, GeneratePromptRequest request, CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        var config = await BuildGenerationConfig(
            request.Description, request.GenerateSystemMessage,
            request.GenerateTemplate, request.GenerateChain,
            request.ToolIds, request.EnableWebSearch, tenantId, ct);

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.GenerateAsync(config, ct, onProgress);
        sw.Stop();

        await LogUsageAsync(tenantId, userId, AiActionType.Generation, sw.ElapsedMilliseconds, result.Usage, ct);

        var scoreHistory = BuildInitialScoreHistory(result.Evaluation);
        var draft = MapPromptSetToDraft(result.Prompts);
        var questions = result.Clarification?.Questions ?? [];
        var enhancements = result.Clarification?.Enhancements ?? [];

        var sessionId = Guid.NewGuid();
        await sessionRepo.CreateAsync(new AiSession
        {
            Id = sessionId,
            TenantId = tenantId,
            Draft = draft,
            Questions = questions,
            Enhancements = enhancements,
            ScoreHistory = scoreHistory,
            Config = config,
            AgentSessionId = result.AgentSessionId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        return ToResult(sessionId, draft, questions, enhancements, result.Evaluation, scoreHistory);
    }

    public async Task<ErrorOr<AiGenerationResult>> RefineAsync(
        Guid tenantId, Guid userId, RefinePromptRequest request, CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        var session = await sessionRepo.GetByIdAsync(tenantId, request.SessionId, ct);
        if (session is null)
            return Error.NotFound("NOT_FOUND", "Session not found or expired.");

        if (session.AgentSessionId is null || session.Config is null)
            return Error.Validation("VALIDATION_ERROR", "Session does not have an active agent workflow.");

        var answers = request.Answers?
            .Where(a => a.QuestionIndex >= 0 && a.QuestionIndex < session.Questions.Count)
            .Select(a => new AnsweredQuestion(
                session.Questions[a.QuestionIndex].Text, a.Answer))
            .ToList() ?? [];

        var selectedEnhancements = request.SelectedEnhancements?
            .Where(i => i >= 0 && i < session.Enhancements.Count)
            .Select(i => session.Enhancements[i])
            .ToList() ?? [];

        var currentEvaluation = session.ScoreHistory.LastOrDefault();
        var evalForRevision = currentEvaluation is not null
            ? new PromptEvaluation { PromptEvaluations = currentEvaluation.Scores }
            : new PromptEvaluation();

        var scoreHistoryAverages = session.ScoreHistory
            .Select(s => s.AverageScore)
            .ToList();

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.RefineAsync(
            session.AgentSessionId, session.Config,
            evalForRevision, answers, selectedEnhancements,
            scoreHistoryAverages, ct, onProgress);
        sw.Stop();

        await LogUsageAsync(tenantId, userId, AiActionType.Generation, sw.ElapsedMilliseconds, result.Usage, ct);

        var newScoreHistory = new List<IterationScore>(session.ScoreHistory);
        if (result.Evaluation is not null)
        {
            var avgScore = EvaluationNormalizer.ComputeAverageScore(result.Evaluation);
            newScoreHistory.Add(new IterationScore
            {
                Iteration = newScoreHistory.Count + 1,
                Scores = result.Evaluation.PromptEvaluations,
                AverageScore = avgScore
            });
        }

        var draft = MapPromptSetToDraft(result.Prompts);
        var questions = result.Clarification?.Questions ?? [];
        var enhancements = result.Clarification?.Enhancements ?? [];

        session.Draft = draft;
        session.Questions = questions;
        session.Enhancements = enhancements;
        session.ScoreHistory = newScoreHistory;
        await sessionRepo.UpdateAsync(session, ct);

        return ToResult(request.SessionId, draft, questions, enhancements, result.Evaluation, newScoreHistory);
    }

    public async Task<ErrorOr<AiGenerationResult>> EnhanceAsync(
        Guid tenantId, Guid userId, Guid entryId, CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return Error.NotFound("NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return Error.NotFound("NOT_FOUND", "No version found for this entry.");

        var prompts = working.Prompts.OrderBy(p => p.Order)
            .Select(p => new PromptInput(p.Content, p.IsTemplate))
            .ToList();

        var config = new GenerationConfig
        {
            Description = $"Enhance existing entry: {entry.Title}",
            GenerateSystemMessage = working.SystemMessage is not null,
            GenerateAsPromptTemplate = prompts.Any(p => p.IsTemplate),
            GenerateAsPromptChain = prompts.Count > 1,
        };

        var sw = Stopwatch.StartNew();
        var result = await orchestrator.EnhanceAsync(working.SystemMessage, prompts, config, ct, onProgress);
        sw.Stop();

        await LogUsageAsync(tenantId, userId, AiActionType.Generation, sw.ElapsedMilliseconds, result.Usage, entryId, ct);

        var scoreHistory = BuildInitialScoreHistory(result.Evaluation);
        var draft = MapPromptSetToDraft(result.Prompts);
        var questions = result.Clarification?.Questions ?? [];
        var enhancements = result.Clarification?.Enhancements ?? [];

        var sessionId = Guid.NewGuid();
        await sessionRepo.CreateAsync(new AiSession
        {
            Id = sessionId,
            TenantId = tenantId,
            Draft = draft,
            Questions = questions,
            Enhancements = enhancements,
            ScoreHistory = scoreHistory,
            Config = config,
            AgentSessionId = result.AgentSessionId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        return ToResult(sessionId, draft, questions, enhancements, result.Evaluation, scoreHistory);
    }

    public async Task<ErrorOr<string>> GenerateSystemMessageAsync(
        Guid tenantId, Guid userId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return Error.NotFound("NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return Error.NotFound("NOT_FOUND", "No version found for this entry.");

        if (!string.IsNullOrEmpty(working.SystemMessage))
            return Error.Conflict("ALREADY_EXISTS", "Entry already has a system message.");

        var promptInputs = working.Prompts.OrderBy(p => p.Order)
            .Select(p => new PromptInput(p.Content, p.IsTemplate))
            .ToList();

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.GenerateSystemMessageAsync(promptInputs, ct);
        sw.Stop();

        await LogUsageAsync(tenantId, userId, AiActionType.SystemMessage, sw.ElapsedMilliseconds, agentResult.Usage, entryId, ct);

        return agentResult.Value;
    }

    public async Task<ErrorOr<List<PromptInput>>> DecomposeAsync(
        Guid tenantId, Guid userId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null || entry.IsTrashed)
            return Error.NotFound("NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return Error.NotFound("NOT_FOUND", "No version found for this entry.");

        if (working.Prompts.Count != 1)
            return Error.Conflict("ALREADY_CHAIN", "Entry must have exactly one prompt to decompose.");

        var sw = Stopwatch.StartNew();
        var agentResult = await orchestrator.DecomposeAsync(
            working.Prompts[0].Content, working.Prompts[0].IsTemplate, working.SystemMessage, ct);
        sw.Stop();

        await LogUsageAsync(tenantId, userId, AiActionType.Decomposition, sw.ElapsedMilliseconds, agentResult.Usage, entryId, ct);

        return agentResult.Value;
    }

    // ── Private helpers ──

    private Task LogUsageAsync(
        Guid tenantId, Guid userId, AiActionType actionType,
        long durationMs, UsageDetails? usage, CancellationToken ct)
        => LogUsageAsync(tenantId, userId, actionType, durationMs, usage, null, ct);

    private Task LogUsageAsync(
        Guid tenantId, Guid userId, AiActionType actionType,
        long durationMs, UsageDetails? usage, Guid? entryId, CancellationToken ct)
    {
        // Generation agent uses Premium model; all others use Default model
        var (modelId, providerName) = actionType == AiActionType.Generation
            ? (agentFactory.PremiumModelId, agentFactory.PremiumProviderName)
            : (agentFactory.DefaultModelId, agentFactory.DefaultProviderName);

        return usageLogger.LogAsync(
            tenantId, userId, actionType,
            modelId ?? "unknown", providerName ?? "unknown",
            usage?.InputTokenCount ?? 0, usage?.OutputTokenCount ?? 0,
            durationMs, entryId, ct);
    }

    private async Task<GenerationConfig> BuildGenerationConfig(
        string description, bool generateSystemMessage,
        bool generateTemplate, bool generateChain,
        List<Guid>? toolIds, bool enableWebSearch,
        Guid tenantId, CancellationToken ct)
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
            EnableWebSearch = enableWebSearch
        };
    }

    private static List<IterationScore> BuildInitialScoreHistory(PromptEvaluation? evaluation)
    {
        if (evaluation is null) return [];

        return
        [
            new IterationScore
            {
                Iteration = 1,
                Scores = evaluation.PromptEvaluations,
                AverageScore = EvaluationNormalizer.ComputeAverageScore(evaluation)
            }
        ];
    }

    private static CreateEntryRequest MapPromptSetToDraft(PromptSet prompts) =>
        new(
            prompts.Title,
            prompts.SystemMessage,
            prompts.Prompts.Select(p => new PromptInput(p.Content, p.IsTemplate)).ToList(),
            null);

    private static AiGenerationResult ToResult(
        Guid sessionId, CreateEntryRequest draft,
        List<ClarificationQuestion> questions, List<string> enhancements,
        PromptEvaluation? evaluation, List<IterationScore> scoreHistory)
    {
        return new AiGenerationResult(
            sessionId, draft,
            questions.Select(q => new ClarificationQuestionDto(q.Text, q.Suggestions)).ToList(),
            enhancements,
            MapEvaluation(evaluation),
            MapScoreHistory(scoreHistory));
    }

    private static EvaluationDto? MapEvaluation(PromptEvaluation? evaluation)
    {
        if (evaluation is null) return null;
        return new EvaluationDto(
            evaluation.PromptEvaluations.ToDictionary(
                kvp => kvp.Key,
                kvp => new EvaluationEntryDto(kvp.Value.Score, kvp.Value.Feedback)));
    }

    private static List<IterationScoreDto> MapScoreHistory(List<IterationScore> history) =>
        history.Select(s => new IterationScoreDto(
            s.Iteration,
            s.Scores.ToDictionary(
                kvp => kvp.Key,
                kvp => new EvaluationEntryDto(kvp.Value.Score, kvp.Value.Feedback)),
            s.AverageScore)).ToList();
}
