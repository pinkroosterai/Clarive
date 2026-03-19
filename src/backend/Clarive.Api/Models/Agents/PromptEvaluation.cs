using System.ComponentModel;

namespace Clarive.Api.Models.Agents;

/// <summary>
/// Evaluation result from the evaluation agent.
/// Contains scores for 4 dimensions: Clarity, Effectiveness, Completeness, Faithfulness.
/// </summary>
public class PromptEvaluation
{
    [Description("Evaluation scores keyed by dimension name")]
    public Dictionary<string, PromptEvaluationEntry> PromptEvaluations { get; set; } = new();
}
