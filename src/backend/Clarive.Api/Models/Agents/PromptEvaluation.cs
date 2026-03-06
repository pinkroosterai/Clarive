using System.ComponentModel;

namespace Clarive.Api.Models.Agents;

/// <summary>
/// Evaluation result from the evaluation agent.
/// Contains scores for 6 dimensions: Clarity, Specificity, Structure, Completeness, Autonomy, Faithfulness.
/// </summary>
public class PromptEvaluation
{
    [Description("Evaluation scores keyed by dimension name")]
    public Dictionary<string, PromptEvaluationEntry> PromptEvaluations { get; set; } = new();
}
