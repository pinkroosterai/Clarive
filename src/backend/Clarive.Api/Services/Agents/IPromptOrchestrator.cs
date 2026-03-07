using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Requests;
using Clarive.Api.Services.Agents.AiExtensions;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Orchestrates the multi-agent prompt generation workflow.
/// </summary>
public interface IPromptOrchestrator
{
    /// <summary>
    /// Generation: creates an agent session, runs the generation agent (multi-turn),
    /// then evaluates + clarifies in parallel.
    /// </summary>
    Task<GenerateOrchestratorResult> GenerateAsync(
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Revision: runs revision on the SAME agent session (multi-turn), then evaluates + clarifies in parallel.
    /// </summary>
    Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId, GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers, List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Enhance: bootstraps an existing entry into the agent workflow with evaluation + clarification.
    /// </summary>
    Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage, List<PromptInput> prompts,
        GenerationConfig config, CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null);

    /// <summary>
    /// Single-turn: generates a system message for existing prompts.
    /// </summary>
    Task<string> GenerateSystemMessageAsync(
        List<PromptInput> prompts, CancellationToken ct = default);

    /// <summary>
    /// Single-turn: decomposes a single prompt into a chain.
    /// </summary>
    Task<List<PromptInput>> DecomposeAsync(
        string promptContent, bool isTemplate, string? systemMessage,
        CancellationToken ct = default);

    bool IsConfigured { get; }
}

public record GenerateOrchestratorResult(
    string AgentSessionId,
    PromptSet Prompts,
    PromptEvaluation? Evaluation,
    ClarificationResult? Clarification);

public record EnhanceOrchestratorResult(
    string AgentSessionId,
    PromptSet Prompts,
    PromptEvaluation? Evaluation,
    ClarificationResult? Clarification);
