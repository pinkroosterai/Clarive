using Clarive.AI.Configuration;
using Clarive.AI.Agents;
using Clarive.AI.Prompts;
using Clarive.AI.Models;
using Clarive.Domain.ValueObjects;
using Clarive.AI.Pipeline;
using Microsoft.Extensions.AI;

namespace Clarive.AI.Orchestration;

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
        Func<ProgressEvent, Task>? onProgress = null
    );

    /// <summary>
    /// Revision: runs revision on the SAME agent session (multi-turn), then evaluates + clarifies in parallel.
    /// </summary>
    Task<GenerateOrchestratorResult> RefineAsync(
        string agentSessionId,
        GenerationConfig config,
        PromptEvaluation currentEvaluation,
        List<AnsweredQuestion> answers,
        List<string> selectedEnhancements,
        List<double>? scoreHistory,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    );

    /// <summary>
    /// Enhance: bootstraps an existing entry into the agent workflow with evaluation + clarification.
    /// </summary>
    Task<EnhanceOrchestratorResult> EnhanceAsync(
        string? systemMessage,
        List<PromptInput> prompts,
        GenerationConfig config,
        CancellationToken ct = default,
        Func<ProgressEvent, Task>? onProgress = null
    );

    /// <summary>
    /// Single-turn: generates a system message for existing prompts.
    /// </summary>
    Task<AgentResult<string>> GenerateSystemMessageAsync(
        List<PromptInput> prompts,
        CancellationToken ct = default
    );

    /// <summary>
    /// Single-turn: generates example values for template fields.
    /// </summary>
    Task<AgentResult<Dictionary<string, string>>> FillTemplateFieldsAsync(
        List<TemplateFieldInfo> fields,
        List<PromptInput> prompts,
        string? systemMessage,
        CancellationToken ct = default
    );

    /// <summary>
    /// Single-turn: decomposes a single prompt into a chain.
    /// </summary>
    Task<AgentResult<List<PromptInput>>> DecomposeAsync(
        string promptContent,
        bool isTemplate,
        string? systemMessage,
        CancellationToken ct = default
    );

    /// <summary>
    /// Single-turn: merges two conflicting versions of a field.
    /// </summary>
    Task<AgentResult<string>> ResolveMergeConflictAsync(
        string fieldName,
        string versionA,
        string versionB,
        CancellationToken ct = default
    );

    /// <summary>
    /// Single-turn: rewrites a rough description into a clear, structured description.
    /// </summary>
    Task<AgentResult<string>> PolishDescriptionAsync(
        string description,
        CancellationToken ct = default
    );

    /// <summary>
    /// Standalone evaluation: scores existing prompts without generation or refinement.
    /// </summary>
    Task<(PromptEvaluation?, UsageDetails?)> EvaluateAsync(
        GenerationConfig config,
        PromptSet prompts,
        CancellationToken ct = default
    );

    bool IsConfigured { get; }
}

public record GenerateOrchestratorResult(
    string AgentSessionId,
    PromptSet Prompts,
    PromptEvaluation? Evaluation,
    ClarificationResult? Clarification,
    UsageDetails? Usage = null,
    UsageDetails? EvaluationUsage = null,
    UsageDetails? ClarificationUsage = null
);

public record AgentResult<T>(T Value, UsageDetails? Usage = null);

public record EnhanceOrchestratorResult(
    string AgentSessionId,
    PromptSet Prompts,
    PromptEvaluation? Evaluation,
    ClarificationResult? Clarification,
    UsageDetails? Usage = null,
    UsageDetails? EvaluationUsage = null,
    UsageDetails? ClarificationUsage = null
);
