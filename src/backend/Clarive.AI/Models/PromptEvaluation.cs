using Clarive.Domain.ValueObjects;
using System.ComponentModel;

namespace Clarive.AI.Models;

/// <summary>
/// Evaluation result from the evaluation agent.
/// Contains scores for 4 dimensions: Clarity, Effectiveness, Completeness, Faithfulness.
/// </summary>
public class PromptEvaluation
{
    [Description("Evaluation scores keyed by dimension name")]
    public Dictionary<string, PromptEvaluationEntry> PromptEvaluations { get; set; } = new();
}
