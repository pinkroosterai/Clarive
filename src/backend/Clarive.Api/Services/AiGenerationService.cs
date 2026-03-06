using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Entities;
using Clarive.Api.Models.Requests;
using Clarive.Api.Models.Responses;
using Clarive.Api.Models.Results;
using Clarive.Api.Repositories.Interfaces;
using Clarive.Api.Services.Agents;
using Clarive.Api.Services.Interfaces;

namespace Clarive.Api.Services;

public class AiGenerationService(
    IPromptOrchestrator orchestrator,
    IAiSessionRepository sessionRepo,
    IEntryRepository entryRepo,
    IToolRepository toolRepo) : IAiGenerationService
{
    public async Task<AiGenerationResult> PreGenClarifyAsync(
        Guid tenantId, string description,
        bool generateSystemMessage, bool generateTemplate, bool generateChain,
        List<Guid>? toolIds, CancellationToken ct,
        Func<string, Task>? onProgress = null)
    {
        var config = await BuildGenerationConfig(
            description, generateSystemMessage, generateTemplate, generateChain,
            toolIds, tenantId, ct);

        var result = await orchestrator.PreGenClarifyAsync(config, ct, onProgress);

        var sessionId = Guid.NewGuid();
        await sessionRepo.CreateAsync(new AiSession
        {
            Id = sessionId,
            TenantId = tenantId,
            Draft = new CreateEntryRequest("", null, [], null),
            Questions = result.Questions,
            Enhancements = result.Enhancements,
            Config = config,
            AgentSessionId = result.AgentSessionId,
            CreatedAt = DateTime.UtcNow
        }, ct);

        return ToResult(sessionId, new CreateEntryRequest("", null, [], null),
            result.Questions, result.Enhancements, null, []);
    }

    public async Task<AiGenerationResult?> GenerateAsync(
        Guid tenantId, GeneratePromptRequest request, CancellationToken ct,
        Func<string, Task>? onProgress = null)
    {
        // Check for existing session from pre-gen-clarify
        AiSession? existingSession = null;
        if (request.SessionId.HasValue)
        {
            existingSession = await sessionRepo.GetByIdAsync(tenantId, request.SessionId.Value, ct);
            if (existingSession is null)
                return null;
        }

        // Build config (reuse from session if available)
        var config = existingSession?.Config ?? await BuildGenerationConfig(
            request.Description, request.GenerateSystemMessage,
            request.GenerateTemplate, request.GenerateChain,
            request.ToolIds, tenantId, ct);

        // Resolve pre-gen answers
        List<AnsweredQuestion>? preGenAnswers = null;
        if (request.PreGenAnswers is { Count: > 0 } && existingSession is not null)
        {
            preGenAnswers = request.PreGenAnswers
                .Where(a => a.QuestionIndex >= 0 && a.QuestionIndex < existingSession.Questions.Count)
                .Select(a => new AnsweredQuestion(
                    existingSession.Questions[a.QuestionIndex].Text, a.Answer))
                .ToList();
        }

        // Resolve selected enhancements
        List<string>? selectedEnhancements = null;
        if (request.SelectedEnhancements is { Count: > 0 } && existingSession is not null)
        {
            selectedEnhancements = request.SelectedEnhancements
                .Where(i => i >= 0 && i < existingSession.Enhancements.Count)
                .Select(i => existingSession.Enhancements[i])
                .ToList();
        }

        // Get or create agent session
        string agentSessionId;
        if (existingSession?.AgentSessionId is not null)
        {
            agentSessionId = existingSession.AgentSessionId;
        }
        else
        {
            var preGenResult = await orchestrator.PreGenClarifyAsync(config, ct);
            agentSessionId = preGenResult.AgentSessionId;
        }

        // This can throw — caller should refund credits
        var result = await orchestrator.GenerateAsync(agentSessionId, config, preGenAnswers, selectedEnhancements, ct, onProgress);

        // Build score history
        var scoreHistory = BuildInitialScoreHistory(result.Evaluation);
        var draft = MapPromptSetToDraft(result.Prompts);
        var questions = result.Clarification?.Questions ?? [];
        var enhancements = result.Clarification?.Enhancements ?? [];

        // Persist session
        var sessionId = existingSession?.Id ?? Guid.NewGuid();
        var session = existingSession ?? new AiSession
        {
            Id = sessionId,
            TenantId = tenantId,
            CreatedAt = DateTime.UtcNow
        };
        session.Draft = draft;
        session.Questions = questions;
        session.Enhancements = enhancements;
        session.ScoreHistory = scoreHistory;
        session.Config = config;
        session.AgentSessionId = agentSessionId;

        if (existingSession is not null)
            await sessionRepo.UpdateAsync(session, ct);
        else
            await sessionRepo.CreateAsync(session, ct);

        return ToResult(sessionId, draft, questions, enhancements, result.Evaluation, scoreHistory);
    }

    public async Task<(AiGenerationResult? Result, string? ErrorCode, string? ErrorMessage)> RefineAsync(
        Guid tenantId, RefinePromptRequest request, CancellationToken ct,
        Func<string, Task>? onProgress = null)
    {
        var session = await sessionRepo.GetByIdAsync(tenantId, request.SessionId, ct);
        if (session is null)
            return (null, "NOT_FOUND", "Session not found or expired.");

        if (session.AgentSessionId is null || session.Config is null)
            return (null, "VALIDATION_ERROR", "Session does not have an active agent workflow.");

        // Resolve answers
        var answers = request.Answers?
            .Where(a => a.QuestionIndex >= 0 && a.QuestionIndex < session.Questions.Count)
            .Select(a => new AnsweredQuestion(
                session.Questions[a.QuestionIndex].Text, a.Answer))
            .ToList() ?? [];

        // Resolve enhancement indices
        var selectedEnhancements = request.SelectedEnhancements?
            .Where(i => i >= 0 && i < session.Enhancements.Count)
            .Select(i => session.Enhancements[i])
            .ToList() ?? [];

        // Get current evaluation from last score history entry
        var currentEvaluation = session.ScoreHistory.LastOrDefault();
        var evalForRevision = currentEvaluation is not null
            ? new PromptEvaluation { PromptEvaluations = currentEvaluation.Scores }
            : new PromptEvaluation();

        var scoreHistoryAverages = session.ScoreHistory
            .Select(s => s.AverageScore)
            .ToList();

        // This can throw — caller should refund credits
        var result = await orchestrator.RefineAsync(
            session.AgentSessionId, session.Config,
            evalForRevision, answers, selectedEnhancements,
            scoreHistoryAverages, ct, onProgress);

        // Append to score history
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

        return (ToResult(request.SessionId, draft, questions, enhancements, result.Evaluation, newScoreHistory), null, null);
    }

    public async Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForEnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return (false, "NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return (false, "NOT_FOUND", "No version found for this entry.");

        return (true, null, null);
    }

    public async Task<AiGenerationResult?> EnhanceAsync(
        Guid tenantId, Guid entryId, CancellationToken ct,
        Func<string, Task>? onProgress = null)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null) return null;

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null) return null;

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

        // This can throw — caller should refund credits
        var result = await orchestrator.EnhanceAsync(working.SystemMessage, prompts, config, ct, onProgress);

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

    public async Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return (false, "NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return (false, "NOT_FOUND", "No version found for this entry.");

        if (!string.IsNullOrEmpty(working.SystemMessage))
            return (false, "ALREADY_EXISTS", "Entry already has a system message.");

        return (true, null, null);
    }

    public async Task<(string? SystemMessage, string? ErrorCode, string? ErrorMessage)> GenerateSystemMessageAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return (null, "NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return (null, "NOT_FOUND", "No version found for this entry.");

        if (!string.IsNullOrEmpty(working.SystemMessage))
            return (null, "ALREADY_EXISTS", "Entry already has a system message.");

        var promptInputs = working.Prompts.OrderBy(p => p.Order)
            .Select(p => new PromptInput(p.Content, p.IsTemplate))
            .ToList();

        // This can throw — caller should refund credits
        var systemMessage = await orchestrator.GenerateSystemMessageAsync(promptInputs, ct);
        return (systemMessage, null, null);
    }

    public async Task<(bool Valid, string? ErrorCode, string? ErrorMessage)> ValidateEntryForDecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return (false, "NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return (false, "NOT_FOUND", "No version found for this entry.");

        if (working.Prompts.Count != 1)
            return (false, "ALREADY_CHAIN", "Entry must have exactly one prompt to decompose.");

        return (true, null, null);
    }

    public async Task<(List<PromptInput>? Prompts, string? ErrorCode, string? ErrorMessage)> DecomposeAsync(
        Guid tenantId, Guid entryId, CancellationToken ct)
    {
        var entry = await entryRepo.GetByIdAsync(tenantId, entryId, ct);
        if (entry is null)
            return (null, "NOT_FOUND", "Entry not found.");

        var working = await entryRepo.GetWorkingVersionAsync(tenantId, entryId, ct);
        if (working is null)
            return (null, "NOT_FOUND", "No version found for this entry.");

        if (working.Prompts.Count != 1)
            return (null, "ALREADY_CHAIN", "Entry must have exactly one prompt to decompose.");

        // This can throw — caller should refund credits
        var decomposed = await orchestrator.DecomposeAsync(
            working.Prompts[0].Content, working.Prompts[0].IsTemplate, working.SystemMessage, ct);
        return (decomposed, null, null);
    }

    // ── Private helpers ──

    private async Task<GenerationConfig> BuildGenerationConfig(
        string description, bool generateSystemMessage,
        bool generateTemplate, bool generateChain,
        List<Guid>? toolIds, Guid tenantId, CancellationToken ct)
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
            SelectedTools = tools
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
