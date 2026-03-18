using System.ComponentModel;

namespace Clarive.Api.Models.Agents;

/// <summary>
/// Evaluation result from the LLM-as-judge for playground run outputs.
/// Contains scores for 5 dimensions: Accuracy, Helpfulness, Relevance, Coherence, Safety.
/// </summary>
public class OutputEvaluation
{
    [Description("Evaluation scores keyed by dimension name")]
    public Dictionary<string, OutputEvaluationEntry> Dimensions { get; set; } = new();

    [Description("Average score across all dimensions (0-10)")]
    public double AverageScore => Dimensions.Count > 0
        ? Dimensions.Values.Average(e => e.Score)
        : 0;
}
