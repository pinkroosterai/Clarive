using System.Diagnostics;
using Clarive.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Clarive.AI.Configuration;
using Clarive.AI.Agents;
using System.ComponentModel;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Clarive.AI.Pipeline;
using Clarive.AI.Prompts;
using Clarive.AI.Evaluation;
using Clarive.Domain.Interfaces.Services;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.OpenAI;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Orchestration;

/// <summary>
/// Orchestrates the multi-agent prompt generation workflow.
/// Scoped lifetime — one instance per HTTP request.
/// </summary>
public class PromptOrchestrator : IPromptOrchestrator
{
    private readonly IAgentFactory _factory;
    private readonly IAgentSessionPool _pool;
    private readonly ITavilyClientService _tavilyClient;
    private readonly ILogger<PromptOrchestrator> _logger;

    public bool IsConfigured => _factory.IsConfigured;

    public PromptOrchestrator(
        IAgentFactory factory,
        IAgentSessionPool pool,
        ITavilyClientService tavilyClient,
        ILogger<PromptOrchestrator> logger
    )
    {
        _factory = factory;
        _pool = pool;
        _tavilyClient = tavilyClient;
        _logger = logger;
    }

    public async Task<GenerateOrchestratorResult> GenerateAsync(
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("AI Generate started");

        if (onProgress is not null)
            await onProgress(ProgressEvent.Generating());

        // Fetch web search tools if enabled
        IList<AITool>? webSearchTools = null;
        if (config.EnableWebSearch)
        {
            webSearchTools = await _tavilyClient.GetToolsAsync(ct);
            if (webSearchTools is null or { Count: 0 })
                throw new InvalidOperationException(
                    "Web search is enabled but the search service is unavailable. Check the Tavily API key configuration."
                );
        }

        // Create the agent session
        var agentSessionId = await _pool.CreateSessionAsync(config, ct, webSearchTools);

        try
        {
            var entry =
                _pool.Get(agentSessionId)
                ?? throw new InvalidOperationException("Agent session expired or not found.");

            PromptSet prompts;
            UsageDetails? genUsage;
            await entry.Lock.WaitAsync(ct);
            try
            {
                // Wire tool progress to SSE callback for the duration of this call
                if (entry.ToolProgress is not null)
                    entry.ToolProgress.OnProgress = onProgress;

                // Run generation (multi-turn session)
                var genTask = TaskBuilder.BuildGenerationTask(config);
                var genResponse = await entry.Agent.RunAsync<PromptSet>(
                    genTask,
                    session: entry.Session,
                    cancellationToken: ct
                );
                prompts = genResponse.Result;
                genUsage = genResponse.Usage;
            }
            finally
            {
                // Clear callback to prevent stale references
                if (entry.ToolProgress is not null)
                    entry.ToolProgress.OnProgress = null;

                entry.Lock.Release();
            }

            ValidatePromptSet(prompts);

            if (onProgress is not null)
                await onProgress(ProgressEvent.Evaluating());

            // Run evaluation + clarification in parallel
            (
                PromptEvaluation? evaluation,
                ClarificationResult? clarification,
                UsageDetails? evalUsage,
                UsageDetails? clarifyUsage
            ) = await RunParallelFeedback(config, prompts, ct, onProgress);

            sw.Stop();
            _logger.LogInformation(
                "AI Generate completed in {DurationMs}ms (input: {InputTokens}, output: {OutputTokens})",
                sw.ElapsedMilliseconds,
                genUsage?.InputTokenCount,
                genUsage?.OutputTokenCount
            );

            return new GenerateOrchestratorResult(
                agentSessionId,
                prompts,
                evaluation,
                clarification,
                genUsage,
                evalUsage,
                clarifyUsage
            );
        }
        catch
        {
            _pool.Remove(agentSessionId);
            throw;
        }
    }

    public async Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId,
        GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers,
        List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("AI Refine started");

        if (onProgress is not null)
            await onProgress(ProgressEvent.Refining());

        var entry =
            _pool.Get(agentSessionId)
            ?? throw new InvalidOperationException("Agent session expired or not found.");

        PromptSet prompts;
        UsageDetails? revUsage;
        await entry.Lock.WaitAsync(ct);
        try
        {
            // Wire tool progress to SSE callback for the duration of this call
            if (entry.ToolProgress is not null)
                entry.ToolProgress.OnProgress = onProgress;

            // Run revision (multi-turn session — preserves context from previous turns)
            var revisionTask = TaskBuilder.BuildRevisionTask(
                config,
                currentEvaluation,
                answers,
                selectedEnhancements,
                scoreHistory
            );

            // For enhance-mode sessions, prepend existing prompt context on the first
            // refinement (replaces the old wasteful bootstrap LLM echo call)
            if (entry.PendingEnhanceContext is { } ctx)
            {
                var enhancePrefix = TaskBuilder.BuildEnhanceBootstrapTask(
                    ctx.SystemMessage, ctx.Prompts);
                revisionTask =
                    $"Here is the existing prompt entry being enhanced:\n\n{enhancePrefix}\n\n{revisionTask}";
                entry.PendingEnhanceContext = null; // Consume — only inject once
            }

            var revResponse = await entry.Agent.RunAsync<PromptSet>(
                revisionTask,
                session: entry.Session,
                cancellationToken: ct
            );
            prompts = revResponse.Result;
            revUsage = revResponse.Usage;
        }
        finally
        {
            // Clear callback to prevent stale references
            if (entry.ToolProgress is not null)
                entry.ToolProgress.OnProgress = null;

            entry.Lock.Release();
        }

        ValidatePromptSet(prompts);

        if (onProgress is not null)
            await onProgress(ProgressEvent.Evaluating());

        // Run evaluation + clarification in parallel
        (
            PromptEvaluation? evaluation,
            ClarificationResult? clarification,
            UsageDetails? evalUsage,
            UsageDetails? clarifyUsage
        ) = await RunParallelFeedback(config, prompts, ct, onProgress);

        sw.Stop();
        _logger.LogInformation(
            "AI Refine completed in {DurationMs}ms (input: {InputTokens}, output: {OutputTokens})",
            sw.ElapsedMilliseconds,
            revUsage?.InputTokenCount,
            revUsage?.OutputTokenCount
        );

        return new GenerateOrchestratorResult(
            agentSessionId,
            prompts,
            evaluation,
            clarification,
            revUsage,
            evalUsage,
            clarifyUsage
        );
    }

    public async Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage,
        List<PromptInput> prompts,
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        _logger.LogInformation("AI Enhance started");
        // Create a dedicated agent session with enhance context stored as metadata.
        // The existing prompt content will be injected into the first refinement task
        // instead of making a wasteful bootstrap LLM call that just echoes it back.
        var enhanceContext = new EnhanceContext(systemMessage, prompts);
        var agentSessionId = await _pool.CreateSessionAsync(
            config, ct, enhanceContext: enhanceContext);

        try
        {
            var promptSet = new PromptSet
            {
                Title = "Existing Entry",
                SystemMessage = systemMessage,
                Prompts = prompts
                    .Select(p => new PromptMessage
                    {
                        Content = p.Content,
                        IsTemplate = p.IsTemplate,
                    })
                    .ToList(),
            };

            if (onProgress is not null)
                await onProgress(ProgressEvent.Evaluating());

            // Run evaluation + clarification in parallel on existing prompts
            (
                PromptEvaluation? evaluation,
                ClarificationResult? clarification,
                UsageDetails? evalUsage,
                UsageDetails? clarifyUsage
            ) = await RunParallelFeedback(config, promptSet, ct, onProgress);

            return new EnhanceOrchestratorResult(
                agentSessionId,
                promptSet,
                evaluation,
                clarification,
                Usage: null, // No bootstrap call — zero wasted tokens
                evalUsage,
                clarifyUsage
            );
        }
        catch
        {
            _pool.Remove(agentSessionId);
            throw;
        }
    }

    public async Task<AgentResult<string>> GenerateSystemMessageAsync(
        List<PromptInput> prompts,
        CancellationToken ct = default
    )
    {
        var sw = Stopwatch.StartNew();
        var agent = _factory.CreateAgent(
            AiActionType.SystemMessage, AgentInstructions.SystemMessage, "SystemMessageGenerator");
        var task = TaskBuilder.BuildSystemMessageTask(prompts);

        var response = await agent.RunAsync<GeneratedSystemMessageOutput>(
            task,
            cancellationToken: ct
        );

        _logger.LogInformation(
            "AI GenerateSystemMessage completed in {DurationMs}ms (input: {InputTokens}, output: {OutputTokens})",
            sw.ElapsedMilliseconds, response.Usage?.InputTokenCount, response.Usage?.OutputTokenCount
        );
        return new AgentResult<string>(response.Result.SystemMessage, response.Usage);
    }

    public async Task<AgentResult<Dictionary<string, string>>> FillTemplateFieldsAsync(
        List<TemplateFieldInfo> fields,
        List<PromptInput> prompts,
        string? systemMessage,
        CancellationToken ct = default
    )
    {
        var sw = Stopwatch.StartNew();
        var agent = _factory.CreateAgent(
            AiActionType.FillTemplateFields, AgentInstructions.FillTemplateFields, "TemplateFieldFiller");
        var task = TaskBuilder.BuildFillTemplateFieldsTask(prompts, systemMessage, fields);

        var response = await agent.RunAsync<TemplateFieldValuesOutput>(task, cancellationToken: ct);

        _logger.LogInformation(
            "AI FillTemplateFields completed in {DurationMs}ms ({FieldCount} fields, input: {InputTokens}, output: {OutputTokens})",
            sw.ElapsedMilliseconds, fields.Count, response.Usage?.InputTokenCount, response.Usage?.OutputTokenCount
        );
        return new AgentResult<Dictionary<string, string>>(response.Result.Values, response.Usage);
    }

    public async Task<AgentResult<List<PromptInput>>> DecomposeAsync(
        string promptContent,
        bool isTemplate,
        string? systemMessage,
        CancellationToken ct = default
    )
    {
        var sw = Stopwatch.StartNew();
        var agent = _factory.CreateAgent(
            AiActionType.Decomposition, AgentInstructions.Decompose, "PromptDecomposer");
        var task = TaskBuilder.BuildDecompositionTask(promptContent, isTemplate, systemMessage);

        var response = await agent.RunAsync<DecomposedChainOutput>(task, cancellationToken: ct);

        var chain = response.Result;
        if (chain.Steps.Count == 0)
            throw new InvalidOperationException(
                "AI returned an empty decomposition. Please try again."
            );

        var result = chain.Steps.Select(s => new PromptInput(s.Content, s.IsTemplate)).ToList();

        _logger.LogInformation(
            "AI Decompose completed in {DurationMs}ms ({StepCount} steps, input: {InputTokens}, output: {OutputTokens})",
            sw.ElapsedMilliseconds, result.Count, response.Usage?.InputTokenCount, response.Usage?.OutputTokenCount
        );
        return new AgentResult<List<PromptInput>>(result, response.Usage);
    }

    // ── Private helpers ──

    private async Task<(
        PromptEvaluation?,
        ClarificationResult?,
        UsageDetails?,
        UsageDetails?
    )> RunParallelFeedback(
        GenerationConfig config,
        PromptSet prompts,
        CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        var evalTask = RunEvaluation(config, prompts, ct);
        var clarifyTask = RunClarification(config, prompts, ct, onProgress);

        await Task.WhenAll(evalTask, clarifyTask);

        var (evaluation, evalUsage) = await evalTask;
        var (clarification, clarifyUsage) = await clarifyTask;

        return (evaluation, clarification, evalUsage, clarifyUsage);
    }

    public Task<(PromptEvaluation?, UsageDetails?)> EvaluateAsync(
        GenerationConfig config,
        PromptSet prompts,
        CancellationToken ct = default
    ) => RunEvaluation(config, prompts, ct);

    private async Task<(PromptEvaluation?, UsageDetails?)> RunEvaluation(
        GenerationConfig config,
        PromptSet prompts,
        CancellationToken ct
    )
    {
        try
        {
            var agent = _factory.CreateAgent(
                AiActionType.Evaluation, AgentInstructions.BuildEvaluation(config), "PromptEvaluator");
            var task = TaskBuilder.BuildEvaluationTask(config, prompts);
            var response = await agent.RunAsync<PromptEvaluation>(task, cancellationToken: ct);
            return (EvaluationNormalizer.Normalize(response.Result), response.Usage);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Evaluation agent failed, returning null evaluation");
            return (null, null);
        }
    }

    private async Task<(ClarificationResult?, UsageDetails?)> RunClarification(
        GenerationConfig config,
        PromptSet prompts,
        CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null
    )
    {
        try
        {
            if (onProgress is not null)
                await onProgress(ProgressEvent.Clarifying());

            var agent = _factory.CreateAgent(
                AiActionType.Clarification, AgentInstructions.Clarification, "PromptClarifier");
            var task = TaskBuilder.BuildClarificationTask(config, prompts);
            var response = await agent.RunAsync<ClarificationResult>(task, cancellationToken: ct);
            return (response.Result, response.Usage);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Clarification agent failed, returning null clarification");
            return (null, null);
        }
    }

    private static void ValidatePromptSet(PromptSet prompts)
    {
        if (prompts.Prompts.Count == 0)
            throw new InvalidOperationException(
                "AI returned an empty prompt set. Please try again."
            );

        if (string.IsNullOrWhiteSpace(prompts.Title))
            prompts.Title = "Untitled Prompt";
    }

    // ── Internal structured output types ──

    internal class GeneratedSystemMessageOutput
    {
        [Description("A system message appropriate for the prompt content")]
        public string SystemMessage { get; set; } = "";
    }

    internal class DecomposedChainOutput
    {
        [Description("3-5 ordered prompt steps that decompose the original prompt")]
        public List<PromptMessage> Steps { get; set; } = [];
    }

    internal class TemplateFieldValuesOutput
    {
        [Description("Mapping of template field names to generated example values")]
        public Dictionary<string, string> Values { get; set; } = new();
    }

    internal class GeneratedMergeOutput
    {
        [Description("The merged text combining both versions")]
        public string MergedText { get; set; } = "";
    }

    public async Task<AgentResult<string>> ResolveMergeConflictAsync(
        string fieldName,
        string versionA,
        string versionB,
        CancellationToken ct
    )
    {
        var sw = Stopwatch.StartNew();
        var instructions = string.Format(AgentInstructions.MergeConflict, fieldName);
        var agent = _factory.CreateAgent(
            AiActionType.SystemMessage, instructions, "MergeConflictResolver");

        var userMessage = $"VERSION A:\n{versionA}\n\nVERSION B:\n{versionB}";
        var response = await agent.RunAsync<GeneratedMergeOutput>(
            userMessage,
            cancellationToken: ct
        );

        var merged = response.Result.MergedText?.Trim();

        _logger.LogInformation(
            "AI MergeConflict completed in {DurationMs}ms (input: {InputTokens}, output: {OutputTokens})",
            sw.ElapsedMilliseconds, response.Usage?.InputTokenCount, response.Usage?.OutputTokenCount
        );
        return new AgentResult<string>(
            string.IsNullOrEmpty(merged) ? versionA : merged,
            response.Usage);
    }

    internal class GeneratedPolishOutput
    {
        [Description("The rewritten description, clear and suitable for AI prompt generation")]
        public string Description { get; set; } = "";
    }

    public async Task<AgentResult<string>> PolishDescriptionAsync(
        string description,
        CancellationToken ct = default
    )
    {
        var sw = Stopwatch.StartNew();
        var agent = _factory.CreateAgent(
            AiActionType.PolishDescription, AgentInstructions.PolishDescription, "DescriptionPolisher");

        var response = await agent.RunAsync<GeneratedPolishOutput>(
            description,
            cancellationToken: ct
        );

        var polished = response.Result.Description?.Trim();

        _logger.LogInformation(
            "AI PolishDescription completed in {DurationMs}ms (input: {InputTokens}, output: {OutputTokens})",
            sw.ElapsedMilliseconds, response.Usage?.InputTokenCount, response.Usage?.OutputTokenCount
        );
        return new AgentResult<string>(
            string.IsNullOrEmpty(polished) ? description : polished,
            response.Usage);
    }
}
