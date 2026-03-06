using Clarive.Api.Models.Agents;
using Clarive.Api.Models.Requests;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Orchestrates the multi-agent prompt generation workflow.
/// </summary>
public interface IPromptOrchestrator
{
    /// <summary>
    /// Pre-generation clarification: creates an agent session and runs the pre-gen agent.
    /// Returns questions and enhancements to help the user refine their request.
    /// </summary>
    Task<PreGenClarifyResult> PreGenClarifyAsync(
        GenerationConfig config, CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Generation: runs the generation agent (multi-turn), then evaluates + clarifies in parallel.
    /// </summary>
    Task<GenerateOrchestratorResult> GenerateAsync(
        string agentSessionId, GenerationConfig config,
        List<AnsweredQuestion>? preGenAnswers,
        List<string>? selectedEnhancements = null,
        CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Revision: runs revision on the SAME agent session (multi-turn), then evaluates + clarifies in parallel.
    /// </summary>
    Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId, GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers, List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

    /// <summary>
    /// Enhance: bootstraps an existing entry into the agent workflow with evaluation + clarification.
    /// </summary>
    Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage, List<PromptInput> prompts,
        GenerationConfig config, CancellationToken ct = default,
        Func<string, Task>? onProgress = null);

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

public record PreGenClarifyResult(
    string AgentSessionId,
    List<ClarificationQuestion> Questions,
    List<string> Enhancements);

public record GenerateOrchestratorResult(
    PromptSet Prompts,
    PromptEvaluation? Evaluation,
    ClarificationResult? Clarification);

public record EnhanceOrchestratorResult(
    string AgentSessionId,
    PromptSet Prompts,
    PromptEvaluation? Evaluation,
    ClarificationResult? Clarification);
