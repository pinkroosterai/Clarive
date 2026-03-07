using System.ComponentModel;
using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Requests;
using Clarive.Api.Services.Agents.AiExtensions;
using Clarive.Api.Services.Interfaces;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.OpenAI;
using Microsoft.Extensions.AI;

namespace Clarive.Api.Services.Agents;

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
        ILogger<PromptOrchestrator> logger)
    {
        _factory = factory;
        _pool = pool;
        _tavilyClient = tavilyClient;
        _logger = logger;
    }

    public async Task<GenerateOrchestratorResult> GenerateAsync(
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        if (onProgress is not null) await onProgress(ProgressEvent.Generating());

        // Fetch web search tools if enabled
        IList<AITool>? webSearchTools = config.EnableWebSearch
            ? await _tavilyClient.GetToolsAsync(ct)
            : null;

        // Create the agent session
        var agentSessionId = await _pool.CreateSessionAsync(config, ct, webSearchTools);

        try
        {
            var entry = _pool.Get(agentSessionId)!;

            PromptSet prompts;
            await entry.Lock.WaitAsync(ct);
            try
            {
                // Wire tool progress to SSE callback for the duration of this call
                if (entry.ToolProgress is not null)
                    entry.ToolProgress.OnProgress = onProgress;

                // Run generation (multi-turn session)
                var genTask = TaskBuilder.BuildGenerationTask(config);
                var genResponse = await entry.Agent.RunAsync<PromptSet>(genTask, session: entry.Session, cancellationToken: ct);
                prompts = genResponse.Result;
            }
            finally
            {
                // Clear callback to prevent stale references
                if (entry.ToolProgress is not null)
                    entry.ToolProgress.OnProgress = null;

                entry.Lock.Release();
            }

            ValidatePromptSet(prompts);

            if (onProgress is not null) await onProgress(ProgressEvent.Evaluating());

            // Run evaluation + clarification in parallel
            (PromptEvaluation? evaluation, ClarificationResult? clarification) = await RunParallelFeedback(config, prompts, ct, onProgress);

            return new GenerateOrchestratorResult(agentSessionId, prompts, evaluation, clarification);
        }
        catch
        {
            _pool.Remove(agentSessionId);
            throw;
        }
    }

    public async Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId, GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers, List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        if (onProgress is not null) await onProgress(ProgressEvent.Refining());

        var entry = _pool.Get(agentSessionId)
            ?? throw new InvalidOperationException("Agent session expired or not found.");

        PromptSet prompts;
        await entry.Lock.WaitAsync(ct);
        try
        {
            // Wire tool progress to SSE callback for the duration of this call
            if (entry.ToolProgress is not null)
                entry.ToolProgress.OnProgress = onProgress;

            // Run revision (multi-turn session — preserves context from previous turns)
            var revisionTask = TaskBuilder.BuildRevisionTask(
                config, currentEvaluation, answers, selectedEnhancements, scoreHistory);
            var revResponse = await entry.Agent.RunAsync<PromptSet>(revisionTask, session: entry.Session, cancellationToken: ct);
            prompts = revResponse.Result;
        }
        finally
        {
            // Clear callback to prevent stale references
            if (entry.ToolProgress is not null)
                entry.ToolProgress.OnProgress = null;

            entry.Lock.Release();
        }

        ValidatePromptSet(prompts);

        if (onProgress is not null) await onProgress(ProgressEvent.Evaluating());

        // Run evaluation + clarification in parallel
        (PromptEvaluation? evaluation, ClarificationResult? clarification) = await RunParallelFeedback(config, prompts, ct, onProgress);

        return new GenerateOrchestratorResult(agentSessionId, prompts, evaluation, clarification);
    }

    public async Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage, List<PromptInput> prompts,
        GenerationConfig config, CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        if (onProgress is not null) await onProgress(ProgressEvent.Bootstrapping());

        // Create a dedicated agent session for the enhance workflow
        var agentSessionId = await _pool.CreateSessionAsync(config, ct);

        try
        {
            var entry = _pool.Get(agentSessionId)!;

            // Bootstrap: feed existing prompts to the generation agent so it has context
            var bootstrapTask = TaskBuilder.BuildEnhanceBootstrapTask(systemMessage, prompts);
            var bootstrapPromptSet = new PromptSet
            {
                Title = "Existing Entry",
                SystemMessage = systemMessage,
                Prompts = prompts.Select(p => new PromptMessage
                {
                    Content = p.Content,
                    IsTemplate = p.IsTemplate
                }).ToList()
            };

            // Seed the generation agent with the existing entry content
            // (This gives it context for future revisions in the same session)
            await entry.Lock.WaitAsync(ct);
            try
            {
                await entry.Agent.RunAsync<PromptSet>(
                    $"Here is an existing prompt entry that the user wants to enhance. " +
                    $"Analyze it and return it as-is for now:\n\n{bootstrapTask}",
                    session: entry.Session, cancellationToken: ct);
            }
            finally
            {
                entry.Lock.Release();
            }

            if (onProgress is not null) await onProgress(ProgressEvent.Evaluating());

            // Run evaluation + clarification in parallel on existing prompts
            (PromptEvaluation? evaluation, ClarificationResult? clarification) = await RunParallelFeedback(config, bootstrapPromptSet, ct, onProgress);

            return new EnhanceOrchestratorResult(agentSessionId, bootstrapPromptSet, evaluation, clarification);
        }
        catch
        {
            _pool.Remove(agentSessionId);
            throw;
        }
    }

    public async Task<string> GenerateSystemMessageAsync(
        List<PromptInput> prompts, CancellationToken ct = default)
    {
        var agent = _factory.CreateSystemMessageAgent();
        var task = TaskBuilder.BuildSystemMessageTask(prompts);

        var response = await agent.RunAsync<GeneratedSystemMessageOutput>(task, cancellationToken: ct);

        return response.Result.SystemMessage;
    }

    public async Task<List<PromptInput>> DecomposeAsync(
        string promptContent, bool isTemplate, string? systemMessage,
        CancellationToken ct = default)
    {
        var agent = _factory.CreateDecomposeAgent();
        var task = TaskBuilder.BuildDecompositionTask(promptContent, isTemplate, systemMessage);

        var response = await agent.RunAsync<DecomposedChainOutput>(task, cancellationToken: ct);

        var chain = response.Result;
        if (chain.Steps.Count == 0)
            throw new InvalidOperationException("AI returned an empty decomposition. Please try again.");

        return chain.Steps
            .Select(s => new PromptInput(s.Content, s.IsTemplate))
            .ToList();
    }

    // ── Private helpers ──

    private async Task<(PromptEvaluation?, ClarificationResult?)> RunParallelFeedback(
        GenerationConfig config, PromptSet prompts, CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        var evalTask = RunEvaluation(config, prompts, ct);
        var clarifyTask = RunClarification(config, prompts, ct, onProgress);

        await Task.WhenAll(evalTask, clarifyTask);

        return (evalTask.Result, clarifyTask.Result);
    }

    private async Task<PromptEvaluation?> RunEvaluation(
        GenerationConfig config, PromptSet prompts, CancellationToken ct)
    {
        try
        {
            var agent = _factory.CreateEvaluationAgent(config);
            var task = TaskBuilder.BuildEvaluationTask(config, prompts);
            var response = await agent.RunAsync<PromptEvaluation>(task, cancellationToken: ct);
            return EvaluationNormalizer.Normalize(response.Result);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Evaluation agent failed, returning null evaluation");
            return null;
        }
    }

    private async Task<ClarificationResult?> RunClarification(
        GenerationConfig config, PromptSet prompts, CancellationToken ct,
        Func<ProgressEvent, Task>? onProgress = null)
    {
        try
        {
            if (onProgress is not null) await onProgress(ProgressEvent.Clarifying());

            var agent = _factory.CreateClarificationAgent();
            var task = TaskBuilder.BuildClarificationTask(config, prompts);
            var response = await agent.RunAsync<ClarificationResult>(task, cancellationToken: ct);
            return response.Result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Clarification agent failed, returning null clarification");
            return null;
        }
    }

    private static void ValidatePromptSet(PromptSet prompts)
    {
        if (prompts.Prompts.Count == 0)
            throw new InvalidOperationException("AI returned an empty prompt set. Please try again.");

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
}
