using Clarive.Api.Models.Agents;

namespace Clarive.Api.Services.Agents;

/// <summary>
/// Normalizes LLM-returned prompt evaluation dimension names to match expected dimensions.
/// Delegates matching logic to <see cref="DimensionNormalizer"/>.
/// </summary>
public static class EvaluationNormalizer
{
    public static readonly string[] ExpectedDimensions =
        ["Clarity", "Effectiveness", "Completeness", "Faithfulness"];

    public static double ComputeAverageScore(PromptEvaluation evaluation)
    {
        var entries = evaluation.PromptEvaluations.Values;
        return entries.Count > 0 ? entries.Average(e => e.Score) : 0;
    }

    public static PromptEvaluation Normalize(PromptEvaluation raw)
    {
        var normalized = DimensionNormalizer.Normalize(
            raw.PromptEvaluations,
            ExpectedDimensions,
            () => new PromptEvaluationEntry
            {
                Score = 0,
                Feedback = "Not evaluated — dimension was missing from the evaluation response."
            });

        return new PromptEvaluation { PromptEvaluations = normalized };
    }
}
